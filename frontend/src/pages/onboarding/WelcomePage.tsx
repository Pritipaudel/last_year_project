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
import { authService } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Z]/, "Password must contain an uppercase letter.")
    .regex(/[a-z]/, "Password must contain a lowercase letter.")
    .regex(/[0-9]/, "Password must contain a number.")
    .regex(/[!@#$%^&*()_+\-=\[\]{};:'".,<>?/\\|`~]/, "Password must contain a special character."),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Name must be at least 2 characters."),
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
        
        if (response.user.onboardingComplete) {
          navigate('/dashboard');
        } else {
          navigate('/onboarding/physiological-profile');
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
    <div className="h-screen flex flex-col lg:flex-row w-full overflow-hidden bg-surface-base">
      {/* LEFT SECTION */}
      <div className="hidden lg:flex lg:w-1/2 h-full items-center justify-center bg-primary text-white p-12">
        <div className="max-w-md">
          <h1 className="text-6xl font-bold mb-4">AECS</h1>
          <p className="text-xl opacity-80 mb-12">Adaptive Exercise Coach System</p>
          <div className="space-y-6">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="p-2 bg-white/10 rounded-lg"><f.icon size={24} /></div>
                <span className="text-lg">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          <div className="flex p-1 bg-muted rounded-xl">
             <button
               onClick={() => setAuthMode('login')}
               className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${isLogin ? 'bg-white shadow' : 'text-muted-foreground'}`}
             >Login</button>
             <button
               onClick={() => setAuthMode('signup')}
               className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${!isLogin ? 'bg-white shadow' : 'text-muted-foreground'}`}
             >Signup</button>
          </div>

          <div className="p-8 bg-card border rounded-2xl shadow-sm space-y-6">
            <h2 className="text-2xl font-bold">{isLogin ? 'Welcome back' : 'Create account'}</h2>
            <form onSubmit={form.handleSubmit(handleSubmit as any)} className="space-y-4">
              {!isLogin && (
                <Input
                  {...form.register("fullName")}
                  placeholder="Full Name"
                  leftIcon={<User size={18} />}
                  error={form.formState.errors.fullName?.message}
                />
              )}
              <Input
                {...form.register("email")}
                placeholder="Email"
                leftIcon={<Mail size={18} />}
                error={form.formState.errors.email?.message}
              />
              <div className="relative">
                <Input
                  {...form.register("password")}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  leftIcon={<Lock size={18} />}
                  error={form.formState.errors.password?.message}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Button type="submit" className="w-full h-12" isLoading={isLoading}>
                {isLogin ? 'Login' : 'Get Started'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
