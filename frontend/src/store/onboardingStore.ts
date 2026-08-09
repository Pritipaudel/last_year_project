import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OnboardingData {
  ageGroup: string;
  sex: string;
  feet: string;
  inches: string;
  height: string;
  weight: string;
  bmi: string | null;
  cameraAllowed: boolean | null;
  photoTaken: boolean;
  selectedGoal: string | null;
  selectedGoals: string[];
}

interface OnboardingState extends OnboardingData {
  setField: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
  setFields: (fields: Partial<OnboardingData>) => void;
  reset: () => void;
}

const initialState: OnboardingData = {
  ageGroup: "",
  sex: "",
  feet: "",
  inches: "",
  height: "",
  weight: "",
  bmi: null,
  cameraAllowed: null,
  photoTaken: false,
  selectedGoal: null,
  selectedGoals: [],
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      setField: (key, value) => set({ [key]: value }),
      setFields: (fields) => set(fields),
      reset: () => set(initialState),
    }),
    {
      name: "posefit-onboarding-storage",
    }
  )
);
