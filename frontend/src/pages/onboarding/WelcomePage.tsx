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
import { authService } from '@/services/authService';

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, "Name must be at least 2 characters."),
});

type FormValues = z.infer<typeof signupSchema>;

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: "Weak", color: "#EF4444" };
  if (score <= 2) return { level: 2, label: "Fair", color: "#F59E0B" };
  if (score <= 3) return { level: 3, label: "Good", color: "#5BA3D0" };
  return { level: 4, label: "Strong", color: "#10B981" };
}

export function WelcomePage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const { addToast } = useUIStore();
  
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isLogin = authMode === 'login';

  const form = useForm<FormValues>({
    resolver: zodResolver((isLogin ? loginSchema : signupSchema) as any),
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
        const response = await authService.login(data);
        setAuth(response.user, response.token);
        addToast({ title: "Welcome back!", type: "success" });
        navigate('/dashboard');
      } else {
        const response = await authService.signup({ name: data.fullName, email: data.email, password: data.password });
        setAuth(response.user, response.token);
        addToast({ title: "Account created successfully!", type: "success" });
        navigate('/onboarding/physiological-profile');
      }
    } catch (error) {
      addToast({ 
        title: "Authentication Failed", 
        description: "Please check your details and try again.", 
        type: "error" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestAccess = () => {
    navigate('/dashboard');
  };

  const watchPassword = form.watch("password");
  const strength = watchPassword ? getPasswordStrength(watchPassword) : null;

  const features = [
    { icon: Crosshair, text: 'Real-time Form Correction' },
    { icon: Stethoscope, text: 'Doctor-Guided Programs' },
    { icon: WifiOff, text: 'Works Offline' },
  ];

  return (
    <div className="h-screen max-h-screen flex flex-col lg:flex-row w-full overflow-hidden">
      {/* LEFT SECTION - Hero/Branding */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="relative hidden lg:flex lg:w-[52%] h-full items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #1A3A5C 0%, #2F5F8A 35%, #4682B4 65%, #5BA3D0 100%)',
        }}
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Top-left soft glow */}
          <motion.div
            animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-16 left-8 w-72 h-72 rounded-full blur-3xl opacity-25"
            style={{ background: 'radial-gradient(circle, #DCEEFF 0%, transparent 70%)' }}
          />
          {/* Bottom-right glow */}
          <motion.div
            animate={{ y: [0, 40, 0], x: [0, -30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-16 right-8 w-96 h-96 rounded-full blur-3xl opacity-18"
            style={{ background: 'radial-gradient(circle, #5BA3D0 0%, transparent 70%)' }}
          />
          {/* Center pulse */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/2 left-1/3 w-52 h-52 rounded-full blur-2xl opacity-20"
            style={{ background: 'radial-gradient(circle, #DCEEFF 0%, transparent 70%)' }}
          />

          {/* Abstract geometric shapes */}
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            className="absolute top-[15%] right-[20%] w-24 h-24 border border-white/10 rounded-2xl"
          />
          <motion.div
            animate={{ rotate: [360, 0] }}
            transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
            className="absolute bottom-[25%] left-[15%] w-16 h-16 border border-white/8 rounded-xl"
          />
          <motion.div
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[60%] right-[10%] w-3 h-3 rounded-full bg-white/15"
          />
          <motion.div
            animate={{ y: [0, 15, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[30%] left-[60%] w-2 h-2 rounded-full bg-white/20"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 px-10 lg:px-16 text-left max-w-xl">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 200 }}
            className="mb-10"
          >
            <div className="relative inline-block">
              <div
                className="absolute inset-0 blur-2xl opacity-40 rounded-2xl scale-150"
                style={{ background: '#DCEEFF' }}
              />
              <svg
                width="72"
                height="72"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="relative"
              >
                <circle cx="40" cy="15" r="8" stroke="white" strokeWidth="3" fill="none" opacity="0.9" />
                <path
                  d="M40 23 C32 26, 28 32, 28 40 L28 55 C28 62, 32 68, 38 71 L42 73 C48 70, 52 64, 52 57 L52 42 C52 35, 48 29, 42 26 Z"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity="0.9"
                />
                <path
                  d="M28 55 L22 68 M52 57 L58 70 M38 71 L35 78 M42 73 L45 80"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.9"
                />
              </svg>
            </div>
          </motion.div>

          {/* Titles */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h1 className="text-5xl lg:text-6xl font-bold text-white mb-3 tracking-tight leading-tight">
              AECS
            </h1>
            <p className="text-xl lg:text-2xl text-white/85 mb-4 font-light tracking-wide">
              Adaptive Exercise Coach System
            </p>
            <p className="text-base text-white/70 max-w-md leading-relaxed">
              Exercise that adapts to you. Personalized AI-powered programs designed for your unique body and goals.
            </p>
          </motion.div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 space-y-3"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                  className="flex items-center gap-3.5 group"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 group-hover:bg-white/15 transition-colors duration-300">
                    <Icon size={18} className="text-white/90" strokeWidth={2} />
                  </div>
                  <span className="text-[15px] font-medium text-white/85 group-hover:text-white transition-colors duration-300">
                    {feature.text}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </motion.div>

      {/* RIGHT SECTION - Authentication */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="lg:w-[48%] flex items-center justify-center px-5 py-8 lg:px-12 h-full overflow-y-auto"
        style={{ background: '#F8FAFC' }}
      >
        <div className="w-full max-w-md my-auto">
          {/* Mobile-only branding */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{ background: '#4682B4' }}>
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 80 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="40" cy="15" r="8" stroke="white" strokeWidth="3" fill="none" />
                  <path d="M40 23 C32 26, 28 32, 28 40 L28 55 C28 62, 32 68, 38 71 L42 73 C48 70, 52 64, 52 57 L52 42 C52 35, 48 29, 42 26 Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <path d="M28 55 L22 68 M52 57 L58 70 M38 71 L35 78 M42 73 L45 80" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1E293B' }}>AECS</h1>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>Exercise that adapts to you</p>
          </div>

          {/* Auth Mode Toggle */}
          <div className="flex gap-1.5 mb-8 p-1 rounded-xl border" style={{ background: '#F1F5F9', borderColor: '#E2E8F0' }}>
            <button
              onClick={() => setAuthMode('login')}
              className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all duration-200"
              style={isLogin ? {
                background: '#4682B4',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(70, 130, 180, 0.25)',
              } : {
                background: 'transparent',
                color: '#64748B',
              }}
            >
              Log In
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className="flex-1 py-3 rounded-lg font-semibold text-sm transition-all duration-200"
              style={!isLogin ? {
                background: '#4682B4',
                color: '#FFFFFF',
                boxShadow: '0 2px 8px rgba(70, 130, 180, 0.25)',
              } : {
                background: 'transparent',
                color: '#64748B',
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Auth Card */}
          <motion.div
            key={authMode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl p-7 sm:p-8 border"
            style={{
              background: '#FFFFFF',
              borderColor: '#E2E8F0',
              boxShadow: '0 10px 40px rgba(70, 130, 180, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <h2 className="text-2xl font-bold mb-1.5" style={{ color: '#1E293B' }}>
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm mb-6" style={{ color: '#64748B' }}>
              {isLogin
                ? 'Enter your credentials to access your account'
                : 'Get started with personalized exercise coaching'}
            </p>

            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
              {/* Full Name - Signup Only */}
              {!isLogin && (
                <div>
                  <label htmlFor="fullName" className="text-sm font-medium mb-1.5 block" style={{ color: '#1E293B' }}>
                    Full Name
                  </label>
                  <Input
                    {...form.register("fullName")}
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    leftIcon={<User size={18} />}
                    error={form.formState.errors.fullName?.message}
                    disabled={isLoading}
                  />
                </div>
              )}

              {/* Email */}
              <div>
                 <label htmlFor="email" className="text-sm font-medium mb-1.5 block" style={{ color: '#1E293B' }}>
                  Email
                </label>
                <Input
                  {...form.register("email")}
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  leftIcon={<Mail size={18} />}
                  error={form.formState.errors.email?.message}
                  disabled={isLoading}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="text-sm font-medium mb-1.5 block" style={{ color: '#1E293B' }}>
                  Password
                </label>
                <div className="relative">
                  <Input
                    {...form.register("password")}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    leftIcon={<Lock size={18} />}
                    error={form.formState.errors.password?.message}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[10px] transition-colors"
                    style={{ color: '#94A3B8' }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Password Strength - Signup Only */}
                {!isLogin && watchPassword && watchPassword.length > 0 && strength && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2.5"
                  >
                    <div className="flex gap-1.5 mb-1">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className="h-1.5 flex-1 rounded-full transition-all duration-300"
                          style={{
                            background: bar <= strength.level ? strength.color : '#E2E8F0',
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-medium" style={{ color: strength.color }}>
                      {strength.label}
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Forgot Password - Login Only */}
              {isLogin && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    className="text-sm font-medium hover:underline transition-colors"
                    style={{ color: '#4682B4' }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 mt-2 text-base shadow-lg"
                isLoading={isLoading}
              >
                {isLogin ? 'Log In' : 'Create Account'}
                {!isLoading && <ArrowRight size={18} className="ml-2" />}
              </Button>

              {/* Divider */}
              <div className="relative my-6 pt-2">
                <div className="absolute inset-0 flex items-center pt-2">
                  <div className="w-full" style={{ borderTop: '1px solid #E2E8F0' }} />
                </div>
                <div className="relative flex justify-center text-sm pt-2">
                  <span className="px-4 text-xs font-medium" style={{ background: '#FFFFFF', color: '#94A3B8' }}>
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" className="mr-2">
                    <path
                      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                      fill="#4285F4"
                    />
                    <path
                      d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z"
                      fill="#34A853"
                    />
                    <path
                      d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.002 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" className="mr-2" fill="currentColor">
                    <path d="M14.94 5.19A4.38 4.38 0 0 0 16 2.25c-1.03.04-2.22.68-2.94 1.53-.65.76-1.22 1.97-.96 3.12 1.03.08 2.09-.53 2.84-1.71zm.96 1.34c-1.57-.09-2.9.89-3.65.89s-1.91-.84-3.15-.82c-1.62.02-3.11.94-3.94 2.39-1.68 2.92-.43 7.25 1.21 9.62.8 1.16 1.75 2.47 3.01 2.42 1.2-.05 1.66-.77 3.11-.77 1.45 0 1.85.77 3.15.74 1.3-.03 2.13-1.18 2.93-2.35.92-1.35 1.3-2.66 1.32-2.73-.03-.01-2.53-.97-2.56-3.85-.03-2.39 1.95-3.54 2.04-3.6-1.11-1.63-2.84-1.81-3.47-1.85z" />
                  </svg>
                  Apple
                </Button>
              </div>

              {/* Guest Access */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGuestAccess}
                  className="w-full text-center text-sm font-medium py-2 hover:underline transition-all"
                  style={{ color: '#64748B' }}
                >
                  Continue as Guest
                </button>
              </div>
            </form>
          </motion.div>

          {/* Footer Note */}
          <p className="text-xs text-center mt-6" style={{ color: '#94A3B8' }}>
            By continuing, you agree to our{' '}
            <a href="#" className="underline" style={{ color: '#4682B4' }}>Terms</a>
            {' '}and{' '}
            <a href="#" className="underline" style={{ color: '#4682B4' }}>Privacy Policy</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
