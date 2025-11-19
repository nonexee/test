import { getErrorMessage, ErrorMessages } from './errors';
import axios, { AxiosError } from 'axios';

describe('Error Utilities', () => {
  describe('getErrorMessage', () => {
    it('should return fallback message for unknown error', () => {
      const result = getErrorMessage(null);
      expect(result).toBe('An unexpected error occurred');
    });

    it('should return custom fallback message', () => {
      const result = getErrorMessage(null, 'Custom fallback');
      expect(result).toBe('Custom fallback');
    });

    it('should extract message from Error instance', () => {
      const error = new Error('Test error message');
      const result = getErrorMessage(error);
      expect(result).toBe('Test error message');
    });

    it('should handle network errors', () => {
      const networkError = {
        isAxiosError: true,
        code: 'ERR_NETWORK',
        response: undefined,
      } as AxiosError;

      Object.setPrototypeOf(networkError, AxiosError.prototype);

      const result = getErrorMessage(networkError);
      expect(result).toContain('Unable to connect');
    });

    it('should handle timeout errors', () => {
      const timeoutError = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        response: undefined,
      } as AxiosError;

      Object.setPrototypeOf(timeoutError, AxiosError.prototype);

      const result = getErrorMessage(timeoutError);
      expect(result).toContain('timed out');
    });

    it('should handle 400 validation errors', () => {
      const validationError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            message: 'Validation failed',
          },
        },
      } as AxiosError;

      Object.setPrototypeOf(validationError, AxiosError.prototype);

      const result = getErrorMessage(validationError);
      expect(result).toContain('Validation failed');
    });

    it('should handle 401 authentication errors', () => {
      const authError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: {},
        },
      } as AxiosError;

      Object.setPrototypeOf(authError, AxiosError.prototype);

      const result = getErrorMessage(authError);
      expect(result).toContain('session has expired');
    });

    it('should handle 404 not found errors', () => {
      const notFoundError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Vendor not found' },
        },
      } as AxiosError;

      Object.setPrototypeOf(notFoundError, AxiosError.prototype);

      const result = getErrorMessage(notFoundError);
      expect(result).toBe('Vendor not found');
    });

    it('should handle 413 file too large errors', () => {
      const fileTooLargeError = {
        isAxiosError: true,
        response: {
          status: 413,
          data: {},
        },
      } as AxiosError;

      Object.setPrototypeOf(fileTooLargeError, AxiosError.prototype);

      const result = getErrorMessage(fileTooLargeError);
      expect(result).toContain('too large');
      expect(result).toContain('10MB');
    });

    it('should handle 429 rate limiting errors', () => {
      const rateLimitError = {
        isAxiosError: true,
        response: {
          status: 429,
          data: {},
        },
      } as AxiosError;

      Object.setPrototypeOf(rateLimitError, AxiosError.prototype);

      const result = getErrorMessage(rateLimitError);
      expect(result).toContain('Too many requests');
    });

    it('should handle 500 server errors', () => {
      const serverError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: {},
        },
      } as AxiosError;

      Object.setPrototypeOf(serverError, AxiosError.prototype);

      const result = getErrorMessage(serverError);
      expect(result).toContain('Server error');
    });
  });

  describe('ErrorMessages.vendor', () => {
    it('should provide vendor-specific error messages', () => {
      const error = new Error('Test error');

      expect(ErrorMessages.vendor.fetch(error)).toContain('Test error');
      expect(ErrorMessages.vendor.list(error)).toContain('Test error');
      expect(ErrorMessages.vendor.create(error)).toContain('Test error');
      expect(ErrorMessages.vendor.update(error)).toContain('Test error');
      expect(ErrorMessages.vendor.delete(error)).toContain('Test error');
    });
  });

  describe('ErrorMessages.document', () => {
    it('should provide document upload specific guidance', () => {
      const fileTooLargeError = {
        isAxiosError: true,
        response: {
          status: 413,
          data: {},
        },
      } as AxiosError;

      Object.setPrototypeOf(fileTooLargeError, AxiosError.prototype);

      const result = ErrorMessages.document.upload(fileTooLargeError);
      expect(result).toContain('too large');
    });

    it('should handle magic byte validation errors', () => {
      const magicByteError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: 'Magic byte validation failed' },
        },
      } as AxiosError;

      Object.setPrototypeOf(magicByteError, AxiosError.prototype);

      const result = ErrorMessages.document.upload(magicByteError);
      expect(result).toContain('Invalid file format');
    });
  });

  describe('ErrorMessages.extraction', () => {
    it('should provide extraction-specific error messages', () => {
      const noDocsError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: 'No documents uploaded' },
        },
      } as AxiosError;

      Object.setPrototypeOf(noDocsError, AxiosError.prototype);

      const result = ErrorMessages.extraction.trigger(noDocsError);
      expect(result).toContain('Cannot start extraction');
    });
  });
});
