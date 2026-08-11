import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface User {
  id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  onboarding_complete?: boolean;
  isAdmin?: boolean;
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
        sessionStorage.removeItem('token');
        // Clear onboarding store to avoid stale data on next login
        try {
          sessionStorage.removeItem('posefit-onboarding-storage');
        } catch (_) { }
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: "posefit-auth-storage",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
