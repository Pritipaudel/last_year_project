import {
  Home,
  Dumbbell,
  Stethoscope,
  History,
  User
} from "lucide-react";

export const NAVIGATION_ITEMS = [
  { label: "Home", path: "/dashboard", icon: Home },
  { label: "Workout", path: "/exercises", icon: Dumbbell },
  { label: "Doctor", path: "/doctors", icon: Stethoscope },
  { label: "History", path: "/history", icon: History },
  { label: "Profile", path: "/profile", icon: User },
];
