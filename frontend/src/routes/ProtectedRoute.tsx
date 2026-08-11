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

  // FORCE ONBOARDING: If authenticated but onboarding is incomplete, send to where they left off. Admins are exempt.
  if (!user?.isAdmin && (user?.onboarding_complete === false || (user as any)?.onboardingComplete === false) && !location.pathname.startsWith('/onboarding')) {
    let redirectPath = "/onboarding/physiological-profile";

    // Determine the furthest incomplete step
    if (onboardingState.bmi) {
      // Completed physiological profile — check later steps
      if (onboardingState.cameraAllowed === null) {
        redirectPath = "/onboarding/camera-permission";
      } else if (!onboardingState.photoTaken) {
        redirectPath = "/onboarding/body-photo";
      } else if (!onboardingState.selectedGoal) {
        redirectPath = "/onboarding/goal-selection";
      } else {
        redirectPath = "/onboarding/goals-confirmation";
      }
    } else if (onboardingState.sex) {
      // Completed steps 1 & 2 — resume at step 3 (height/weight)
      redirectPath = "/onboarding/physiological-profile";
    } else if (onboardingState.ageGroup) {
      // Completed step 1 — resume at step 2 (sex)
      redirectPath = "/onboarding/physiological-profile";
    }

    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
}
