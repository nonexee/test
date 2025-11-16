import axios from 'axios';

// Validate API URL is configured in production
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !apiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is required in production');
}

if (!apiUrl && typeof window !== 'undefined') {
  console.warn('⚠️  WARNING: NEXT_PUBLIC_API_URL not set. Using default http://localhost:3001');
}

const apiClient = axios.create({
  baseURL: apiUrl || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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
