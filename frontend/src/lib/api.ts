import axios from 'axios';
import { analytics } from './utils/analytics';

// Validate API URL is configured in production
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !apiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is required in production');
}

if (!apiUrl && typeof window !== 'undefined') {
  console.warn('⚠️  WARNING: NEXT_PUBLIC_API_URL not set. Using default http://localhost:3001');
}

/**
 * FIXED GAP #1: Authentication with httpOnly cookies
 *
 * - Added withCredentials: true to send/receive cookies
 * - Removed Authorization header logic (tokens in httpOnly cookies)
 * - Backend sets cookies via Set-Cookie header
 * - Axios automatically includes cookies in subsequent requests
 */
const apiClient = axios.create({
  baseURL: apiUrl || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // CRITICAL: Send cookies with every request
});

// Request interceptor to track requests (LOW #48 fix)
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // Track API request timing
      (config as any).metadata = { startTime: Date.now() };
    }
    return config;
  },
  (error) => {
    analytics.trackError(error, { context: 'api_request' });
    return Promise.reject(error);
  }
);

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;

interface QueuedRequest {
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}

let failedQueue: QueuedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor for error handling, analytics, and token refresh (GAP #13 fix)
apiClient.interceptors.response.use(
  (response) => {
    // Track successful API calls
    if ((response.config as any).metadata?.startTime) {
      const duration = Date.now() - (response.config as any).metadata.startTime;
      const endpoint = `${response.config.method}_${response.config.url}`.substring(0, 50);
      analytics.trackPerformance(`api_${endpoint}`, duration);
    }
    return response;
  },
  async (error) => {
    // Track API errors
    analytics.trackError(error, {
      context: 'api_response',
      method: error.config?.method,
      url: error.config?.url,
      status: error.response?.status,
    });

    const originalRequest = error.config;

    // FIX GAP #13: Implement token refresh on 401 errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry auth endpoints (login, register, refresh, logout)
      if (originalRequest.url?.includes('/auth/')) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the access token
        await apiClient.post('/auth/refresh');

        // Refresh successful, process queued requests
        processQueue(null);
        isRefreshing = false;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, user needs to login again
        processQueue(refreshError, null);
        isRefreshing = false;

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
