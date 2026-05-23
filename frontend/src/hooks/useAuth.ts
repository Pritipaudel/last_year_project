import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, setUser, logout } = useAuthStore();
  
  return {
    user,
    token,
    isAuthenticated,
    setAuth,
    setUser,
    logout,
  };
}
