import axios, { AxiosError } from 'axios';

interface ErrorResponse {
  message?: string;
  error?: string;
  statusCode?: number;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Extract a user-friendly error message from an API error
 */
export function getErrorMessage(error: unknown, fallback: string = 'An unexpected error occurred'): string {
  // Handle Axios errors
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ErrorResponse>;

    // Network errors (no response from server)
    if (!axiosError.response) {
      if (axiosError.code === 'ERR_NETWORK') {
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      }
      if (axiosError.code === 'ECONNABORTED') {
        return 'Request timed out. Please try again.';
      }
      return 'Network error. Please check your connection and try again.';
    }

    const { status, data } = axiosError.response;

    // Handle validation errors (400)
    if (status === 400) {
      // If we have field-specific errors, return them
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        const fieldErrors = data.errors.map(e => `${e.field}: ${e.message}`).join(', ');
        return `Validation error: ${fieldErrors}`;
      }
      // Otherwise return the general message
      return data.message || data.error || 'Invalid request. Please check your input and try again.';
    }

    // Handle authentication errors (401)
    if (status === 401) {
      return 'Your session has expired. Please log in again.';
    }

    // Handle authorization errors (403)
    if (status === 403) {
      return 'You do not have permission to perform this action.';
    }

    // Handle not found errors (404)
    if (status === 404) {
      return data.message || 'The requested resource was not found.';
    }

    // Handle conflict errors (409)
    if (status === 409) {
      return data.message || 'A conflict occurred. This resource may already exist.';
    }

    // Handle file too large (413)
    if (status === 413) {
      return 'File is too large. Maximum file size is 10MB.';
    }

    // Handle rate limiting (429)
    if (status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    // Handle server errors (5xx)
    if (status >= 500) {
      return data.message || 'Server error. Please try again later or contact support if the problem persists.';
    }

    // Return the API message if available
    if (data.message) {
      return data.message;
    }
    if (data.error) {
      return data.error;
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Fallback
  return fallback;
}

/**
 * Get a user-friendly error message for specific operations
 */
export const ErrorMessages = {
  vendor: {
    fetch: (error: unknown) => getErrorMessage(error, 'Failed to load vendor details. Please refresh the page.'),
    list: (error: unknown) => getErrorMessage(error, 'Failed to load vendors. Please refresh the page.'),
    create: (error: unknown) => getErrorMessage(error, 'Failed to create vendor. Please check your input and try again.'),
    update: (error: unknown) => getErrorMessage(error, 'Failed to update vendor. Please check your input and try again.'),
    delete: (error: unknown) => getErrorMessage(error, 'Failed to delete vendor. Please try again.'),
  },
  document: {
    upload: (error: unknown) => {
      const message = getErrorMessage(error);
      // Add specific guidance for common upload issues
      if (message.includes('413') || message.includes('too large')) {
        return 'File is too large. Please select a file smaller than 10MB.';
      }
      if (message.includes('415') || message.includes('Unsupported Media Type')) {
        return 'Unsupported file type. Please upload PDF, DOC, DOCX, TXT, CSV, XLS, or XLSX files.';
      }
      if (message.includes('Magic byte')) {
        return 'Invalid file format detected. Please ensure the file is a valid document and not renamed.';
      }
      return message || 'Failed to upload document. Please ensure the file is valid and try again.';
    },
  },
  extraction: {
    trigger: (error: unknown) => {
      const message = getErrorMessage(error);
      if (message.includes('No documents')) {
        return 'Cannot start extraction. Please upload at least one document first.';
      }
      return message || 'Failed to start extraction. Please try again.';
    },
    sources: (error: unknown) => getErrorMessage(error, 'Failed to load source information. Please try again.'),
  },
  auth: {
    login: (error: unknown) => {
      const message = getErrorMessage(error);
      if (message.includes('401')) {
        return 'Invalid email or password. Please check your credentials and try again.';
      }
      return message || 'Login failed. Please check your credentials and try again.';
    },
    register: (error: unknown) => {
      const message = getErrorMessage(error);
      if (message.includes('409') || message.includes('already exists')) {
        return 'An account with this email already exists. Please log in instead.';
      }
      return message || 'Registration failed. Please check your information and try again.';
    },
  },
};
