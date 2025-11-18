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

// Response interceptor for error handling and analytics (LOW #48 fix)
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
  (error) => {
    // Track API errors
    analytics.trackError(error, {
      context: 'api_response',
      method: error.config?.method,
      url: error.config?.url,
      status: error.response?.status,
    });

    if (error.response?.status === 401) {
      // Dispatch custom event for Auth Context to handle
      // This prevents race conditions between interceptor and component error handlers
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
