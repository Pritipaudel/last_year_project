// import { api } from "./api";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  imageUrl: string;
}

const MOCK_EXERCISES: Exercise[] = [
  {
    id: "1",
    name: "Push-ups",
    muscleGroup: "Chest",
    difficulty: "Beginner",
    imageUrl: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=500&q=80",
  },
  {
    id: "2",
    name: "Squats",
    muscleGroup: "Legs",
    difficulty: "Beginner",
    imageUrl: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500&q=80",
  },
  {
    id: "3",
    name: "Pull-ups",
    muscleGroup: "Back",
    difficulty: "Intermediate",
    imageUrl: "https://images.unsplash.com/photo-1598971484999-692dcce2c040?w=500&q=80",
  },
];

export const exerciseService = {
  getExercises: async (): Promise<Exercise[]> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return MOCK_EXERCISES;
  },

  getExerciseById: async (id: string): Promise<Exercise | undefined> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return MOCK_EXERCISES.find((e) => e.id === id);
  },
};
