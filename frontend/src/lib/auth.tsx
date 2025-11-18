'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from './api';
import type { User, Tenant, AuthResponse } from '@/types';

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (tenantName: string, adminEmail: string, adminPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * FIXED GAP #1: Authentication Flow
     *
     * Backend uses httpOnly cookies for tokens (more secure against XSS).
     * Frontend no longer expects tokens in response or localStorage.
     *
     * On initial load, we:
     * 1. Check localStorage for user/tenant (convenience, not security)
     * 2. Verify session is valid by calling a protected endpoint
     * 3. If invalid, clear localStorage and show login
     */
    const initializeAuth = async () => {
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      try {
        // Check if we have cached user data
        const storedUser = localStorage.getItem('user');
        const storedTenant = localStorage.getItem('tenant');

        if (storedUser && storedTenant) {
          // Verify the session is still valid by making an authenticated request
          // If httpOnly cookie exists and is valid, this will succeed
          try {
            await apiClient.get('/vendors?limit=0'); // Quick check, no data needed

            // Session is valid, restore user state
            setUser(JSON.parse(storedUser));
            setTenant(JSON.parse(storedTenant));
          } catch (error) {
            // Session expired or invalid, clear localStorage
            localStorage.removeItem('user');
            localStorage.removeItem('tenant');
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Listen for unauthorized events from API interceptor
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUnauthorized = () => {
      // Clear auth state
      logout();
      // Redirect to login page
      window.location.href = '/auth/login';
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (email: string, password: string) => {
    /**
     * FIXED GAP #1: No longer expects token in response
     *
     * Backend sets httpOnly cookies automatically via Set-Cookie header.
     * Response only contains { user, tenant }.
     * We store user/tenant in localStorage for convenience (not security).
     */
    const response = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    const { user: userData, tenant: tenantData } = response.data;

    // Store user/tenant for convenience (UI display, caching)
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('tenant', JSON.stringify(tenantData));
    }

    setUser(userData);
    setTenant(tenantData);
  };

  const register = async (tenantName: string, adminEmail: string, adminPassword: string) => {
    /**
     * FIXED GAP #1: No longer expects token in response
     *
     * Backend sets httpOnly cookies automatically.
     * Response only contains { user, tenant }.
     */
    const response = await apiClient.post<AuthResponse>('/auth/register-tenant', {
      tenantName,
      adminEmail,
      adminPassword,
    });
    const { user: userData, tenant: tenantData } = response.data;

    // Store user/tenant for convenience
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('tenant', JSON.stringify(tenantData));
    }

    setUser(userData);
    setTenant(tenantData);
  };

  const logout = async () => {
    /**
     * FIXED GAP #1: Call backend to clear httpOnly cookies
     *
     * Must call POST /auth/logout to revoke refresh token and clear cookies.
     * Then clear local state.
     */
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Even if logout fails, clear local state
      console.error('Logout error:', error);
    }

    // Clear local storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
    }

    // Clear state
    setUser(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
