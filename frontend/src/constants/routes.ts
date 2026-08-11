export const ROUTES = {
  HOME: "/",
  WELCOME: "/welcome",
  DASHBOARD: "/dashboard",
  EXERCISES: "/exercises",
  EXERCISE_PREVIEW: (id: string) => `/exercises/${id}`,
  ACTIVE_WORKOUT: "/workout/active",
  SESSION_SUMMARY: "/workout/summary",
  DOCTORS: "/doctors",
  HISTORY: "/history",
  PROFILE: "/profile",

  // Onboarding
  ONBOARDING_PROFILE: "/onboarding/physiological-profile",
  ONBOARDING_CAMERA: "/onboarding/camera-permission",
  ONBOARDING_BODY_PHOTO: "/onboarding/body-photo",
  ONBOARDING_GOALS: "/onboarding/goal-selection",
  ONBOARDING_CONFIRM: "/onboarding/goals-confirmation",
  ONBOARDING_COMPLETE: "/onboarding/complete",
};
