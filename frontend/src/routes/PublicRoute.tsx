import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function PublicRoute() {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    // Admins skip the onboarding flow entirely.
    if (user?.isAdmin) {
      return <Navigate to="/admin/doctors" replace />;
    }
    if (user?.onboarding_complete === false) {
      return <Navigate to="/onboarding/physiological-profile" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
