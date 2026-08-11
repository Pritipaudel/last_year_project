import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Crosshair, Stethoscope, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/store/uiStore';
import { authService, biometricService } from '@/lib/api';
import { useOnboardingStore } from '@/store/onboardingStore';

const loginSchema = z.object({
  email: z.string().min(1, "Please enter your email or username."),
  password: z.string().min(1, "Please enter your password."),
});

const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain an uppercase letter.")
    .regex(/[a-z]/, "Password must contain a lowercase letter.")
    .regex(/[0-9]/, "Password must contain a number.")
    .regex(/[!@#$%^&*()_+\-=\[\]{};:'".,<>?/\\|`~]/, "Password must contain a special character."),
});

type FormValues = z.infer<typeof signupSchema>;

export function WelcomePage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const { addToast } = useUIStore();

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isLogin = authMode === 'login';

  const form = useForm<FormValues>({
    resolver: zodResolver(isLogin ? loginSchema : signupSchema) as any,
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
  });

  const handleSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      if (isLogin) {
        const response = await authService.login({
          username: data.email,
          password: data.password
        });

        setAuth(response.user, response.access);
        addToast({ title: "Welcome back!", description: "Successfully logged in.", type: "success" });

        // Device Agnostic Resume: always reset store first to avoid stale data
        const store = useOnboardingStore.getState();
        store.reset();

        if (response.user.isAdmin) {
          navigate('/admin/doctors');
        } else if (response.user.onboarding_complete === false || (response.user as any).onboardingComplete === false) {
          // Fetch profile from backend to know where they left off
          try {
            const profile = await biometricService.getProfile();
            if (profile) {
              if (profile.age_group) store.setField('ageGroup', profile.age_group);
              if (profile.sex) store.setField('sex', profile.sex);
              if (profile.height) store.setField('height', profile.height.toString());
              if (profile.weight) store.setField('weight', profile.weight.toString());
              if (profile.bmi) store.setField('bmi', profile.bmi.toString());

              if (profile.goal === 'assessment_init') {
                store.setField('photoTaken', true);
                store.setField('cameraAllowed', true);
              } else if (profile.goal && profile.goal !== 'assessment_init') {
                store.setField('photoTaken', true);
                store.setField('cameraAllowed', true);
                store.setField('selectedGoal', profile.goal);
              }
            }
          } catch (e) {
            console.error("Failed to sync profile:", e);
          }
          // ProtectedRoute will now correctly bounce them to exactly where they left off
          navigate('/onboarding/physiological-profile');
        } else {
          navigate('/dashboard');
        }
      } else {
        await authService.register({
          username: data.email,
          email: data.email,
          password: data.password,
          password_confirm: data.password,
          first_name: data.fullName.split(' ')[0],
          last_name: data.fullName.split(' ').slice(1).join(' ')
        });

        const loginResponse = await authService.login({
          username: data.email,
          password: data.password
        });

        setAuth(loginResponse.user, loginResponse.access);
        // Always start fresh for new signups
        useOnboardingStore.getState().reset();
        addToast({ title: "Account created!", description: "Let's set up your profile.", type: "success" });
        navigate('/onboarding/physiological-profile');
      }
    } catch (error: any) {
      let errorMessage = "Something went wrong. Please try again.";
      let hasFieldErrors = false;

      console.error("Auth error:", error);

      // Handle network errors
      if (!error.response) {
        errorMessage = error.message || "Network error. Please check your connection and try again.";
      } else if (error.response?.status === 401) {
        // Login failure - set field errors
        form.setError('email', {
          type: 'manual',
          message: 'Invalid email or password'
        });
        form.setError('password', {
          type: 'manual',
          message: ''
        });
        hasFieldErrors = true;
      } else if (error.response?.status === 400) {
        const errorData = error.response.data;

        if (typeof errorData === 'object') {
          // Handle specific field validation errors
          if (errorData.email) {
            form.setError('email', {
              type: 'manual',
              message: Array.isArray(errorData.email) ? errorData.email[0] : errorData.email
            });
            hasFieldErrors = true;
          }

          if (errorData.username) {
            form.setError('email', {
              type: 'manual',
              message: Array.isArray(errorData.username) ? errorData.username[0] : errorData.username
            });
            hasFieldErrors = true;
          }

          if (errorData.password) {
            form.setError('password', {
              type: 'manual',
              message: Array.isArray(errorData.password) ? errorData.password[0]?.message || errorData.password[0] : errorData.password
            });
            hasFieldErrors = true;
          }

          if (errorData.fullName) {
            form.setError('fullName', {
              type: 'manual',
              message: Array.isArray(errorData.fullName) ? errorData.fullName[0] : errorData.fullName
            });
            hasFieldErrors = true;
          }

          if (errorData.detail && !hasFieldErrors) {
            errorMessage = errorData.detail;
          }
        }
      } else if (error.response?.status) {
        // Other HTTP errors
        errorMessage = error.response.data?.detail || `Error: ${error.response.statusText || 'Request failed'}`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Only show toast if there are no field-specific errors to display
      if (!hasFieldErrors) {
        addToast({ title: "Error", description: errorMessage, type: "error" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Crosshair, text: 'Real-time Form Correction' },
    { icon: Stethoscope, text: 'Doctor-Guided Programs' },
    { icon: WifiOff, text: 'Works Offline' },
  ];

  return (
    <div className="h-screen w-full flex items-center justify-center relative overflow-hidden bg-[var(--bg-dashboard)] p-6">

      {/* LOGO IN TOP LEFT CORNER */}
      <div className="absolute top-4 left-6 lg:top-10 lg:left-12">
        <h1 className="text-3xl font-bold text-[var(--primary-solid)] tracking-wider">PoseFit</h1>
      </div>

      {/* CENTERED AUTH CARD */}
      <div className="w-full max-w-md space-y-6">

        <div className='text-center'>
          <h2 className="text-2xl font-bold text-[var(--text-main)]">{isLogin ? 'Welcome back' : 'Create account'}</h2>
        </div>

        {/* Main Form Card */}
        <div className="p-8 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl shadow-sm space-y-6">
          {/* Tab Switcher */}
          <div className="flex p-1 bg-[var(--accent-surface)] rounded-xl">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${isLogin
                ? 'bg-[var(--bg-card)] text-[var(--primary-solid)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
            >
              Login
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${!isLogin
                ? 'bg-[var(--bg-card)] text-[var(--primary-solid)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
            >
              Signup
            </button>
          </div>


          <form onSubmit={form.handleSubmit(handleSubmit as any)} className="space-y-5">

            {/* FULL NAME FIELD (SIGNUP ONLY) */}
            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider">Full Name</label>
                <Input
                  {...form.register("fullName")}
                  placeholder="e.g. John Doe"
                  leftIcon={<User size={18} className="text-[var(--text-muted)]" />}
                  error={form.formState.errors.fullName?.message}
                />
              </div>
            )}

            {/* EMAIL FIELD */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider">Email or Username</label>
              <Input
                {...form.register("email")}
                placeholder={isLogin ? "e.g. john@example.com or admin" : "e.g. john@example.com"}
                leftIcon={<Mail size={18} className="text-[var(--text-muted)]" />}
                error={form.formState.errors.email?.message}
              />
            </div>

            {/* PASSWORD FIELD */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider">Password</label>
              <div className="relative">
                <Input
                  {...form.register("password")}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  leftIcon={<Lock size={18} className="text-[var(--text-muted)]" />}
                  error={form.formState.errors.password?.message}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              className="w-full h-12 mt-2 rounded-xl text-white font-semibold flex items-center justify-center transition-colors bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] disabled:opacity-70"
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : (isLogin ? 'Login' : 'Get Started')}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
