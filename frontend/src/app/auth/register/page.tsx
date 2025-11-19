'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import {
  validateEmail,
  validatePassword,
  validateTenantName,
  validatePasswordsMatch,
  calculatePasswordStrength,
} from '@/lib/utils/validation';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [tenantName, setTenantName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation errors
  const [tenantNameError, setTenantNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // Touch tracking
  const [touched, setTouched] = useState({
    tenantName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  const passwordStrength = calculatePasswordStrength(adminPassword);

  const handleTenantNameChange = (value: string) => {
    setTenantName(value);
    if (touched.tenantName) {
      const validation = validateTenantName(value);
      setTenantNameError(validation.valid ? '' : validation.error || '');
    }
  };

  const handleEmailChange = (value: string) => {
    setAdminEmail(value);
    if (touched.email) {
      const validation = validateEmail(value);
      setEmailError(validation.valid ? '' : validation.error || '');
    }
  };

  const handlePasswordChange = (value: string) => {
    setAdminPassword(value);
    if (touched.password) {
      const validation = validatePassword(value);
      setPasswordError(validation.valid ? '' : validation.error || '');
    }
    if (touched.confirmPassword && confirmPassword) {
      const matchValidation = validatePasswordsMatch(value, confirmPassword);
      setConfirmPasswordError(matchValidation.valid ? '' : matchValidation.error || '');
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (touched.confirmPassword) {
      const validation = validatePasswordsMatch(adminPassword, value);
      setConfirmPasswordError(validation.valid ? '' : validation.error || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Mark all as touched
    setTouched({ tenantName: true, email: true, password: true, confirmPassword: true });

    // Validate all fields
    const tenantValidation = validateTenantName(tenantName);
    const emailValidation = validateEmail(adminEmail);
    const passwordValidation = validatePassword(adminPassword);
    const matchValidation = validatePasswordsMatch(adminPassword, confirmPassword);

    setTenantNameError(tenantValidation.valid ? '' : tenantValidation.error || '');
    setEmailError(emailValidation.valid ? '' : emailValidation.error || '');
    setPasswordError(passwordValidation.valid ? '' : passwordValidation.error || '');
    setConfirmPasswordError(matchValidation.valid ? '' : matchValidation.error || '');

    if (
      !tenantValidation.valid ||
      !emailValidation.valid ||
      !passwordValidation.valid ||
      !matchValidation.valid
    ) {
      return;
    }

    setLoading(true);

    try {
      await register(tenantName, adminEmail, adminPassword);
      router.push('/vendors');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-8">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-2 text-center text-gray-900">Create Your Account</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Start managing your vendor compliance today
        </p>

        {error && (
          <div
            className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Organization Name */}
          <div>
            <label htmlFor="tenantName" className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <input
              id="tenantName"
              name="tenantName"
              type="text"
              autoComplete="organization"
              value={tenantName}
              onChange={(e) => handleTenantNameChange(e.target.value)}
              onBlur={() => {
                setTouched({ ...touched, tenantName: true });
                const validation = validateTenantName(tenantName);
                setTenantNameError(validation.valid ? '' : validation.error || '');
              }}
              aria-invalid={!!tenantNameError}
              aria-describedby={tenantNameError ? 'tenantName-error' : undefined}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                tenantNameError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {tenantNameError && (
              <p
                id="tenantName-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {tenantNameError}
              </p>
            )}
          </div>

          {/* Admin Email */}
          <div>
            <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Admin Email
            </label>
            <input
              id="adminEmail"
              name="adminEmail"
              type="email"
              autoComplete="email"
              value={adminEmail}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => {
                setTouched({ ...touched, email: true });
                const validation = validateEmail(adminEmail);
                setEmailError(validation.valid ? '' : validation.error || '');
              }}
              aria-invalid={!!emailError}
              aria-describedby={emailError ? 'email-error' : undefined}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                emailError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {emailError && (
              <p
                id="email-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {emailError}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="adminPassword"
              name="adminPassword"
              type="password"
              autoComplete="new-password"
              value={adminPassword}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={() => {
                setTouched({ ...touched, password: true });
                const validation = validatePassword(adminPassword);
                setPasswordError(validation.valid ? '' : validation.error || '');
              }}
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? 'password-error password-strength' : 'password-strength'}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                passwordError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />

            {/* Password Strength Indicator */}
            {adminPassword && (
              <div
                id="password-strength"
                className="mt-2"
                aria-live="polite"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all duration-300`}
                      style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                      role="progressbar"
                      aria-valuenow={passwordStrength.score}
                      aria-valuemin={0}
                      aria-valuemax={4}
                      aria-label="Password strength"
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{passwordStrength.label}</span>
                </div>
                {passwordStrength.suggestions.length > 0 && (
                  <ul className="text-xs text-gray-600 space-y-0.5">
                    {passwordStrength.suggestions.map((suggestion, idx) => (
                      <li key={idx}>• {suggestion}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {passwordError && (
              <p
                id="password-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {passwordError}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              onBlur={() => {
                setTouched({ ...touched, confirmPassword: true });
                const validation = validatePasswordsMatch(adminPassword, confirmPassword);
                setConfirmPasswordError(validation.valid ? '' : validation.error || '');
              }}
              aria-invalid={!!confirmPasswordError}
              aria-describedby={confirmPasswordError ? 'confirmPassword-error' : undefined}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                confirmPasswordError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {confirmPasswordError && (
              <p
                id="confirmPassword-error"
                className="mt-1 text-sm text-red-600"
                role="alert"
              >
                {confirmPasswordError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              !!tenantNameError ||
              !!emailError ||
              !!passwordError ||
              !!confirmPasswordError ||
              passwordStrength.score < 2
            }
            aria-label={loading ? 'Creating account, please wait' : 'Create your account'}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading && (
              <svg
                className="animate-spin h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          {passwordStrength.score < 2 && adminPassword && (
            <p className="text-xs text-center text-gray-600">
              Please choose a stronger password to continue
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/login" prefetch={true} className="text-blue-600 hover:underline font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
