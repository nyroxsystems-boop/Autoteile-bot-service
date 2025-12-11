import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

type MerchantSession = {
  merchantId: string;
};

type AuthContextValue = {
  session: MerchantSession | null;
  login: (merchantId: string, password: string) => Promise<boolean>;
  register: (merchantId: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USERS_KEY = 'merchant_users';
const SESSION_KEY = 'merchant_session';

function readUsers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeUsers(u: Record<string, string>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<MerchantSession | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  const login = async (merchantId: string, password: string) => {
    const users = readUsers();
    if (users[merchantId] && users[merchantId] === password) {
      setSession({ merchantId });
      return true;
    }
    return false;
  };

  const register = async (merchantId: string, password: string) => {
    const users = readUsers();
    if (users[merchantId]) return false; // already exists
    users[merchantId] = password;
    writeUsers(users);
    setSession({ merchantId });
    return true;
  };

  const logout = () => {
    setSession(null);
    navigate('/auth');
  };

  const value = useMemo(() => ({ session, login, register, logout }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}
