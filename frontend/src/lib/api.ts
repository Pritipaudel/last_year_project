import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to attach JWT token to every request
api.interceptors.request.use(
    (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor to handle unauthorized errors (token expired)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            sessionStorage.removeItem('token');
            // Only redirect on non-auth endpoints (avoid loop on login itself)
            if (!error.config?.url?.includes('auth/')) {
                window.location.href = '/welcome';
            }
        }
        return Promise.reject(error);
    }
);

export const authService = {
    register: async (userData: any) => {
        const { data } = await api.post('auth/register/', userData);
        return data;
    },
    login: async (credentials: any) => {
        const { data } = await api.post('auth/login/', credentials);
        if (data.access) {
            sessionStorage.setItem('token', data.access);
        }
        if (data.user) {
            data.user = {
                ...data.user,
                name: data.user.first_name || data.user.username,
                onboarding_complete: data.user.onboarding_complete ?? false,
                isAdmin: data.user.isAdmin ?? false,
            };
        }
        return data;
    },
    logout: () => {
        sessionStorage.removeItem('token');
    },
    getMe: () => api.get('auth/me/'),
};

export const biometricService = {
    getProfile: async () => {
        const { data } = await api.get('biometrics/profile/');
        return data;
    },
    saveProfile: (profileData: any) => api.patch('biometrics/profile/', profileData),
    completeOnboarding: () => api.patch('biometrics/profile/', { onboarding_complete: true }),
    deleteProfile: () => api.delete('biometrics/profile/'),
    submitAssessment: (assessmentData: any) => {
        // If data is FormData (for image uploads), axial headers are handled automatically
        return api.post('biometrics/assess/', assessmentData);
    },
};

export default api;
