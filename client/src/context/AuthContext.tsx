import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  isAdmin: boolean;
  isTechnician: boolean;
  isFrontOffice: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('resortcare_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('resortcare_token') || null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Verify token on mount
    if (token) {
      api.get<{ user: User }>('/auth/me')
        .then(res => {
          setUser(res.user);
          localStorage.setItem('resortcare_user', JSON.stringify(res.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('resortcare_token', newToken);
    localStorage.setItem('resortcare_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('resortcare_token');
    localStorage.removeItem('resortcare_user');
  };

  const hasRole = (roles: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'Super Admin') return true;
    return roles.includes(user.role);
  };

  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Hotel Admin';
  const isTechnician = user?.role === 'Technician';
  const isFrontOffice = user?.role === 'Front Office Staff' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        hasRole,
        isAdmin,
        isTechnician,
        isFrontOffice
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
