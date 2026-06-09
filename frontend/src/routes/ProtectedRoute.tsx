import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/welcome" state={{ from: location }} replace />;
  }

  // FORCE ONBOARDING: If authenticated but onboarding is incomplete, send to first step
  if (user?.onboardingComplete === false && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/onboarding/physiological-profile" replace />;
  }

  return <Outlet />;
}
