import React, { createContext, useContext, useEffect, useState } from 'react';
import { getItem, setItem, deleteItem } from '../utils/tokenStorage';
import { apiClient } from '../api/client';
import { User } from '../types/models';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: 'cliente' | 'proveedor' | 'profesional';
  address?: string;
  profession?: string;
  experience_years?: number;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    try {
      const stored = await getItem('jwt_token');
      if (stored) {
        setToken(stored);
        const me = await apiClient('/api/auth/me');
        setUser(me);
      }
    } catch (err) {
      console.log('init auth error', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await apiClient('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.access_token) throw new Error('Token no recibido');
    await setItem('jwt_token', res.access_token);
    setToken(res.access_token);
    const me = await apiClient('/api/auth/me');
    setUser(me);
  }

  async function register(payload: RegisterPayload) {
    await apiClient('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await login(payload.email, payload.password);
  }

  async function logout() {
    await deleteItem('jwt_token');
    setToken(null);
    setUser(null);
  }

  async function refreshUser() {
    const me = await apiClient('/api/auth/me');
    setUser(me);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
