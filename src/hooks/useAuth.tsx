import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { PaymentMethod, User } from '@/types';
import { apiFetch, setToken } from '@/lib/api';
import { firebaseAuth } from '@/lib/firebase';

interface LoginResult {
  success: boolean;
  reason?: 'invalid_credentials' | 'email_not_verified';
}

interface RegisterResult {
  success: boolean;
  reason?: 'email_exists' | 'server_error';
}

interface VerifyEmailResult {
  success: boolean;
  reason?: 'invalid_code' | 'expired_code' | 'email_not_found' | 'server_error';
}

interface ResetResult {
  success: boolean;
  reason?: 'invalid_code' | 'expired_code' | 'email_not_found' | 'server_error';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  verifyEmail: (email?: string, code?: string) => Promise<VerifyEmailResult>;
  resendVerificationCode: (email?: string) => Promise<{ success: boolean }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; reason?: 'email_not_found' | 'server_error' }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<ResetResult>;
  logout: () => void;
  addPaymentMethod: (method: Omit<PaymentMethod, 'id' | 'isDefault'>) => Promise<void>;
  setDefaultPaymentMethod: (methodId: string) => Promise<void>;
  removePaymentMethod: (methodId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_KEY = 'lootbox_user';

function saveSessionUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function mapFirebaseError(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  return message.toLowerCase();
}

async function backendSync(firebaseUser: FirebaseUser): Promise<User | null> {
  const token = await firebaseUser.getIdToken();
  setToken(token);
  try {
    const res = await apiFetch<{ user: User }>('/api/auth/me');
    return res.user;
  } catch {
    return {
      id: firebaseUser.uid,
      name: firebaseUser.displayName || 'Utilizador',
      email: firebaseUser.email || '',
      avatar: (firebaseUser.displayName || firebaseUser.email || 'U').charAt(0).toUpperCase(),
      paymentMethods: [],
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!firebaseAuth) {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      saveSessionUser(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (!firebaseUser) {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        saveSessionUser(null);
        return;
      }

      await reload(firebaseUser);
      if (!firebaseUser.emailVerified) {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        saveSessionUser(null);
        return;
      }

      const synced = await backendSync(firebaseUser);
      setUser(synced);
      setIsAuthenticated(true);
      saveSessionUser(synced);
      window.dispatchEvent(new Event('lootbox-auth-changed'));
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    if (!firebaseAuth) return { success: false, reason: 'invalid_credentials' };
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await reload(cred.user);
      if (!cred.user.emailVerified) {
        return { success: false, reason: 'email_not_verified' };
      }
      const synced = await backendSync(cred.user);
      setUser(synced);
      setIsAuthenticated(true);
      saveSessionUser(synced);
      window.dispatchEvent(new Event('lootbox-auth-changed'));
      return { success: true };
    } catch {
      return { success: false, reason: 'invalid_credentials' };
    }
  };

  const register = async (name: string, email: string, password: string): Promise<RegisterResult> => {
    if (!firebaseAuth) return { success: false, reason: 'server_error' };
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await sendEmailVerification(cred.user);
      return { success: true };
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (msg.includes('email-already-in-use')) return { success: false, reason: 'email_exists' };
      return { success: false, reason: 'server_error' };
    }
  };

  const verifyEmail = async (): Promise<VerifyEmailResult> => {
    if (!firebaseAuth) return { success: false, reason: 'server_error' };
    try {
      const current = firebaseAuth.currentUser;
      if (!current) return { success: false, reason: 'email_not_found' };
      await reload(current);
      if (!current.emailVerified) return { success: false, reason: 'invalid_code' };
      return { success: true };
    } catch {
      return { success: false, reason: 'server_error' };
    }
  };

  const resendVerificationCode = async () => {
    if (!firebaseAuth) return { success: false };
    try {
      const current = firebaseAuth.currentUser;
      if (!current) return { success: false };
      await sendEmailVerification(current);
      return { success: true };
    } catch {
      return { success: false };
    }
  };

  const requestPasswordReset = async (email: string) => {
    if (!firebaseAuth) return { success: false, reason: 'server_error' as const };
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      return { success: true };
    } catch (err) {
      const msg = mapFirebaseError(err);
      if (msg.includes('user-not-found')) return { success: false, reason: 'email_not_found' as const };
      return { success: false, reason: 'server_error' as const };
    }
  };

  const resetPassword = async (): Promise<ResetResult> => {
    return { success: false, reason: 'server_error' };
  };

  const logout = () => {
    if (firebaseAuth) {
      void signOut(firebaseAuth);
    }
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    saveSessionUser(null);
    window.dispatchEvent(new Event('lootbox-auth-changed'));
  };

  const syncPaymentMethods = async () => {
    const data = await apiFetch<{ paymentMethods: PaymentMethod[] }>('/api/payment-methods');
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, paymentMethods: data.paymentMethods };
      saveSessionUser(next);
      return next;
    });
  };

  const addPaymentMethod = async (method: Omit<PaymentMethod, 'id' | 'isDefault'>) => {
    await apiFetch('/api/payment-methods', {
      method: 'POST',
      body: JSON.stringify(method),
    });
    await syncPaymentMethods();
  };

  const setDefaultPaymentMethod = async (methodId: string) => {
    await apiFetch(`/api/payment-methods/${methodId}/default`, { method: 'PATCH' });
    await syncPaymentMethods();
  };

  const removePaymentMethod = async (methodId: string) => {
    await apiFetch(`/api/payment-methods/${methodId}`, { method: 'DELETE' });
    await syncPaymentMethods();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        register,
        verifyEmail,
        resendVerificationCode,
        requestPasswordReset,
        resetPassword,
        logout,
        addPaymentMethod,
        setDefaultPaymentMethod,
        removePaymentMethod,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
