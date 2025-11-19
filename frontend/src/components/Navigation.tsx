'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

/**
 * Navigation component with logout functionality
 * Fixes GAP #11: No logout button in application
 */
export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, tenant, logout } = useAuth();

  // Don't show navigation on auth pages
  if (pathname?.startsWith('/auth') || !user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Navigation Links */}
          <div className="flex items-center gap-8">
            <Link href="/vendors" className="text-xl font-bold text-gray-900">
              VendorFlow AI
            </Link>
            <div className="flex gap-4">
              <Link
                href="/vendors"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === '/vendors' || pathname?.startsWith('/vendors')
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Vendors
              </Link>
              <Link
                href="/compliance/dora"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === '/compliance/dora'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                DORA Register
              </Link>
              <Link
                href="/audit"
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === '/audit'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Audit Logs
              </Link>
            </div>
          </div>

          {/* User Info and Logout */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-right">
              <div className="font-medium text-gray-900">{user.email}</div>
              <div className="text-xs text-gray-500">
                {tenant?.name} • {user.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
