import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

import { PublicRoute } from "./PublicRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "@/layouts/AppLayout";
import { OnboardingLayout } from "@/layouts/OnboardingLayout";

// Screens
import { SplashScreen } from "@/pages/onboarding/SplashScreen";
import { WelcomePage } from "@/pages/onboarding/WelcomePage";
import { PhysiologicalProfilePage } from "@/pages/onboarding/PhysiologicalProfilePage";
import { CameraPermissionPage } from "@/pages/onboarding/CameraPermissionPage";
import { BodyPhotoPage } from "@/pages/onboarding/BodyPhotoPage";
import { GoalSelectionPage } from "@/pages/onboarding/GoalSelectionPage";
import { GoalsConfirmationPage } from "@/pages/onboarding/GoalsConfirmationPage";
import { OnboardingCompletePage } from "@/pages/onboarding/OnboardingCompletePage";

import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ExerciseSelectionPage } from "@/pages/workout/ExerciseSelectionPage";
import { ExercisePreviewPage } from "@/pages/workout/ExercisePreviewPage";
import { ActiveWorkoutPage } from "@/pages/workout/ActiveWorkoutPage";
import { SessionSummaryPage } from "@/pages/workout/SessionSummaryPage";
import { DoctorSearchPage } from "@/pages/doctor/DoctorSearchPage";
import { DoctorProfilePage } from "@/pages/doctor/DoctorProfilePage";
import { AppointmentBookingPage } from "@/pages/doctor/AppointmentBookingPage";
import { DoctorChatPage } from "@/pages/doctor/DoctorChatPage";
import { DoctorCallPage } from "@/pages/doctor/DoctorCallPage";
import { HistoryPage } from "@/pages/history/HistoryPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";

export const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <Navigate to={ROUTES.WELCOME} replace />,
  },
  
  // Public Entry (Login / Signup)
  {
    element: <PublicRoute />,
    children: [
      { path: ROUTES.WELCOME, element: <WelcomePage /> },
    ],
  },
  
  // Protected Onboarding Flow
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/onboarding",
        element: <OnboardingLayout />,
        children: [
          { path: "physiological-profile", element: <PhysiologicalProfilePage /> },
          { path: "camera-permission", element: <CameraPermissionPage /> },
          { path: "body-photo", element: <BodyPhotoPage /> },
          { path: "goal-selection", element: <GoalSelectionPage /> },
          { path: "goals-confirmation", element: <GoalsConfirmationPage /> },
        ],
      },
      
      // Onboarding Complete (full-screen, no OnboardingLayout)
      {
        path: "/onboarding/complete",
        element: <OnboardingCompletePage />,
      },
      
      // Protected App Flow
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
          { path: ROUTES.EXERCISES, element: <ExerciseSelectionPage /> },
          { path: "/exercises/:id", element: <ExercisePreviewPage /> },
          { path: ROUTES.ACTIVE_WORKOUT, element: <ActiveWorkoutPage /> },
          { path: ROUTES.SESSION_SUMMARY, element: <SessionSummaryPage /> },
          { path: ROUTES.DOCTORS, element: <DoctorSearchPage /> },
          { path: "/doctors/:id", element: <DoctorProfilePage /> },
          { path: "/doctors/:id/book", element: <AppointmentBookingPage /> },
          { path: "/doctors/:id/chat", element: <DoctorChatPage /> },
          { path: "/doctors/:id/call", element: <DoctorCallPage /> },
          { path: ROUTES.HISTORY, element: <HistoryPage /> },
          { path: ROUTES.PROFILE, element: <ProfilePage /> },
        ],
      },
    ],
  },
  
  // Fallback
  {
    path: "*",
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);
