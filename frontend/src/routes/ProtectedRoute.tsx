import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingStore } from "@/store/onboardingStore";

export function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const onboardingState = useOnboardingStore();

  if (!isAuthenticated) {
    return <Navigate to="/welcome" state={{ from: location }} replace />;
  }

  // FORCE ONBOARDING: If authenticated but onboarding is incomplete, send to where they left off
  if (user?.onboardingComplete === false && !location.pathname.startsWith('/onboarding')) {
    let redirectPath = "/onboarding/physiological-profile";
    
    // Determine the furthest incomplete step
    if (onboardingState.bmi) {
      if (onboardingState.cameraAllowed === null) {
        redirectPath = "/onboarding/camera-permission";
      } else if (!onboardingState.photoTaken) {
         redirectPath = "/onboarding/body-photo";
      } else if (!onboardingState.selectedGoal) {
         redirectPath = "/onboarding/goal-selection";
      } else {
         redirectPath = "/onboarding/goals-confirmation";
      }
    }
    
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
}
