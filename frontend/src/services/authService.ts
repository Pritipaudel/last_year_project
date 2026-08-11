import { api } from "./api";
import { User } from "@/store/authStore";

export interface AuthResponse {
  user: User;
  token: string;
}

export const authService = {
  login: async (credentials: any): Promise<AuthResponse> => {
    // In a real app: return (await api.post("/auth/login", credentials)).data;
    
    // Stub implementation for now
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      user: { id: "1", username: "janedoe", name: "Jane Doe", email: credentials.email, onboarding_complete: true },
      token: "mock-jwt-token-12345",
    };
  },

  signup: async (userData: any): Promise<AuthResponse> => {
    // Stub implementation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      user: { id: "1", username: userData.name, name: userData.name, email: userData.email, onboarding_complete: false },
      token: "mock-jwt-token-12345",
    };
  },
};
