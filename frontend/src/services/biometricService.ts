import { api } from "./api";

export interface BiometricProfile {
  age_group: string;
  sex: string;
  height: number;
  weight: number;
  bmi: number;
  goal: string;
  privacy_consent_timestamp: string;
}

export const biometricService = {
  /**
   * Fetch the authenticated user's biometric profile
   */
  getProfile: async (): Promise<BiometricProfile | null> => {
    try {
      const { data } = await api.get("biometrics/profile/");
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Update the user's biometric profile
   */
  updateProfile: async (profile: Partial<BiometricProfile>): Promise<BiometricProfile> => {
    const { data } = await api.patch("biometrics/profile/", profile);
    return data;
  }
};
