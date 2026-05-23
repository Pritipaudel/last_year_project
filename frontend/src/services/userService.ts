// import { api } from "./api";

export const userService = {
  getProfile: async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { name: "Jane Doe", healthGoals: "Build muscle", level: "Intermediate" };
  },
  updateProfile: async (data: any) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true, data };
  }
};
