import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
  token: string;
}

type RawUser = Partial<User> & { _id?: string; id?: string };

const normalizeUser = (raw: RawUser | null | undefined): User | null => {
  if (!raw) return null;
  const id = raw.id ?? raw._id;
  const username = raw.username;
  const email = raw.email;
  const token = raw.token;

  if (!id || !username || !email || !token) return null;

  return {
    id: String(id),
    username: String(username),
    email: String(email),
    token: String(token),
  };
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: RawUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => {
        const normalized = normalizeUser(user);
        set({ user: normalized, isAuthenticated: !!normalized });
      },
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage', // Keeps user logged in after refresh
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<AuthState>) };
        const normalized = normalizeUser((merged as any).user);
        return {
          ...merged,
          user: normalized,
          isAuthenticated: !!normalized,
        };
      },
    }
  )
);