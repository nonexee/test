/**
 * Standardized error messages across the API (MEDIUM #29)
 *
 * This file provides consistent, user-friendly error messages for common operations.
 * Using constants ensures:
 * - Consistency across all endpoints
 * - Easy localization in the future
 * - Single source of truth for error messaging
 */

export const ErrorMessages = {
  // Authentication Errors
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_ALREADY_EXISTS: 'An account with this email already exists',
    UNAUTHORIZED: 'Authentication required',
    TOKEN_EXPIRED: 'Your session has expired. Please log in again',
    INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token',
  },

  // Vendor Errors
  VENDOR: {
    NOT_FOUND: 'Vendor not found',
    ACCESS_DENIED: 'You do not have permission to access this vendor',
    NOT_FOUND_OR_ACCESS_DENIED: 'Vendor not found or access denied',
    CREATE_FAILED: 'Failed to create vendor',
    UPDATE_FAILED: 'Failed to update vendor',
    DELETE_FAILED: 'Failed to delete vendor',
    ALREADY_EXISTS: 'A vendor with this name already exists',
  },

  // Document Errors
  DOCUMENT: {
    NOT_FOUND: 'Document not found',
    NOT_FOUND_OR_ACCESS_DENIED: 'Document not found or access denied',
    UPLOAD_FAILED: 'Failed to upload document',
    DELETE_FAILED: 'Failed to delete document',
    INVALID_FILE_TYPE: 'Invalid file type. Supported formats: PDF, DOC, DOCX, TXT, CSV, XLS, XLSX',
    FILE_TOO_LARGE: 'File size exceeds maximum limit of 10MB',
    NO_FILE_PROVIDED: 'No file was provided',
  },

  // Extraction Errors
  EXTRACTION: {
    NO_DOCUMENTS: 'Cannot extract facts: vendor has no documents. Please upload documents first',
    JOB_NOT_FOUND: 'Extraction job not found',
    FAILED: 'Fact extraction failed',
    ALREADY_RUNNING: 'An extraction job is already running for this vendor',
  },

  // Tenant Errors
  TENANT: {
    NOT_FOUND: 'Tenant not found',
    CREATION_FAILED: 'Failed to create tenant',
  },

  // User Errors
  USER: {
    NOT_FOUND: 'User not found',
    INVALID_ROLE: 'Invalid user role',
  },

  // Generic Errors
  GENERIC: {
    INTERNAL_ERROR: 'An unexpected error occurred. Please try again later',
    BAD_REQUEST: 'Invalid request data',
    NOT_FOUND: 'Resource not found',
    FORBIDDEN: 'You do not have permission to perform this action',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
    VALIDATION_FAILED: 'Validation failed',
  },

  // Configuration Errors
  CONFIG: {
    MISSING_ENV_VAR: 'Required configuration is missing',
    INVALID_CONFIG: 'Invalid configuration',
  },
} as const;

/**
 * Helper function to format error messages with dynamic data
 */
export function formatErrorMessage(template: string, data: Record<string, any>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}
