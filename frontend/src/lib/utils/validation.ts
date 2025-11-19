/**
 * Client-side validation utilities
 * Matches backend validation rules for consistency
 */

export interface PasswordStrength {
  score: number; // 0-4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
  suggestions: string[];
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  return { valid: true };
}

/**
 * Validate password (matches backend regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{8,}$/)
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[\d\W]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number or special character' };
  }

  return { valid: true };
}

/**
 * Calculate password strength (0-4)
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: 'Very Weak',
      color: 'bg-gray-300',
      suggestions: ['Enter a password'],
    };
  }

  let score = 0;
  const suggestions: string[] = [];

  // Length check
  if (password.length >= 8) score++;
  else suggestions.push('Use at least 8 characters');

  if (password.length >= 12) score++;
  else if (password.length >= 8) suggestions.push('Consider using 12+ characters for better security');

  // Character variety
  if (/[a-z]/.test(password)) score++;
  else suggestions.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score++;
  else suggestions.push('Add uppercase letters');

  if (/\d/.test(password)) score++;
  else suggestions.push('Add numbers');

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  else suggestions.push('Add special characters (!@#$%^&*)');

  // Penalize common patterns
  if (/^(password|12345678|qwerty)/i.test(password)) {
    score = Math.max(0, score - 2);
    suggestions.push('Avoid common passwords');
  }

  // Normalize score to 0-4
  score = Math.min(4, Math.floor(score / 1.5));

  const strengthMap: Record<number, { label: PasswordStrength['label']; color: string }> = {
    0: { label: 'Very Weak', color: 'bg-red-500' },
    1: { label: 'Weak', color: 'bg-orange-500' },
    2: { label: 'Fair', color: 'bg-yellow-500' },
    3: { label: 'Strong', color: 'bg-green-500' },
    4: { label: 'Very Strong', color: 'bg-green-600' },
  };

  return {
    score,
    ...strengthMap[score],
    suggestions: suggestions.slice(0, 2), // Limit to top 2 suggestions
  };
}

/**
 * Validate tenant name
 */
export function validateTenantName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: 'Organization name is required' };
  }

  if (name.length < 2) {
    return { valid: false, error: 'Organization name must be at least 2 characters' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Organization name must be less than 100 characters' };
  }

  return { valid: true };
}

/**
 * Validate passwords match
 */
export function validatePasswordsMatch(
  password: string,
  confirmPassword: string
): { valid: boolean; error?: string } {
  if (!confirmPassword) {
    return { valid: false, error: 'Please confirm your password' };
  }

  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }

  return { valid: true };
}
