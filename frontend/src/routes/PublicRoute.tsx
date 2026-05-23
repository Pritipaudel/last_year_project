import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function PublicRoute() {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    if (user?.onboardingComplete === false) {
      return <Navigate to="/onboarding/physiological-profile" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
