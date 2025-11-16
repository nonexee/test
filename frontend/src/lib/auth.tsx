'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from './api';

interface User {
  id: string;
  email: string;
  role: string;
}

interface Tenant {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (tenantName: string, adminEmail: string, adminPassword: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user from localStorage on mount
    const storedUser = localStorage.getItem('user');
    const storedTenant = localStorage.getItem('tenant');
    if (storedUser && storedTenant) {
      setUser(JSON.parse(storedUser));
      setTenant(JSON.parse(storedTenant));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    const { token, user: userData, tenant: tenantData } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('tenant', JSON.stringify(tenantData));

    setUser(userData);
    setTenant(tenantData);
  };

  const register = async (tenantName: string, adminEmail: string, adminPassword: string) => {
    const response = await apiClient.post('/auth/register-tenant', {
      tenantName,
      adminEmail,
      adminPassword,
    });
    const { token, user: userData, tenant: tenantData } = response.data;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('tenant', JSON.stringify(tenantData));

    setUser(userData);
    setTenant(tenantData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
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
