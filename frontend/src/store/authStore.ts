import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  onboardingComplete?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('token');
        // Clear onboarding store to avoid stale data on next login
        try {
          localStorage.removeItem('aecs-onboarding-storage');
        } catch (_) { }
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: "aecs-auth-storage",
    }
  )
);
