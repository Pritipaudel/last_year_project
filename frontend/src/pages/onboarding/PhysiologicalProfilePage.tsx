import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Briefcase, User, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageTransition } from '@/components/common/PageTransition';
import { useOnboardingStore } from '@/store/onboardingStore';
import { biometricService } from '@/lib/api';
import { useUIStore } from '@/store/uiStore';

export function PhysiologicalProfilePage() {
  const navigate = useNavigate();
  const { setFields } = useOnboardingStore();
  const { addToast } = useUIStore();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    ageGroup: '',
    sex: '',
    height: '',
    weight: '',
  });

  const ageGroups = [
// ... (omitted same content for brevity in instruction, but will include in replacement)
    { value: '18-25', label: '18-25', icon: GraduationCap },
    { value: '26-40', label: '26-40', icon: Briefcase },
    { value: '41-60', label: '41-60', icon: User },
    { value: '60+', label: '60+', icon: UserCircle },
  ];

  const sexOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'prefer-not-to-say', label: 'Prefer not to say' },
  ];

  const calculateBMI = () => {
    const heightM = parseFloat(formData.height) / 100; // cm to m
    const weightKg = parseFloat(formData.weight);
    if (heightM && weightKg) {
      return (weightKg / (heightM * heightM)).toFixed(1);
    }
    return null;
  };

  const handleContinue = async () => {
    if (step === 1 && formData.ageGroup) {
      setStep(2);
    } else if (step === 2 && formData.sex) {
      setStep(3);
    } else if (step === 3 && formData.height && formData.weight) {
      setIsSaving(true);
      try {
        const bmi = calculateBMI();
        
        // Persist to backend
        await biometricService.saveProfile({
          age_group: formData.ageGroup,
          sex: formData.sex,
          height: parseFloat(formData.height),
          weight: parseFloat(formData.weight),
          privacy_consent_timestamp: new Date().toISOString() // Core requirement
        });

        setFields({
          ageGroup: formData.ageGroup,
          sex: formData.sex,
          height: formData.height,
          weight: formData.weight,
          bmi,
        });

        navigate('/onboarding/camera-permission');
      } catch (error: any) {
        addToast({
          title: "Setup Error",
          description: error.response?.data?.message || "Failed to save profile. Please try again.",
          type: "error"
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const isStepComplete = () => {
    if (step === 1) return !!formData.ageGroup;
    if (step === 2) return !!formData.sex;
    if (step === 3) return !!formData.height && !!formData.weight;
    return false;
  };

  const bmi = calculateBMI();

  return (
    <PageTransition variant="fade" className="flex flex-col max-h-screen bg-[var(--bg-dashboard)]">
      <div className="px-4 py-8 max-w-md mx-auto w-full flex-1 flex flex-col">
        {/* Header & Progress */}
        <div className="mb-8">
          <button 
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))} 
          className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-text)] hover:text-[var(--primary-hover)] transition-colors w-fit mb-6"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>Back</span>
        </button>

          <p className="text-sm mb-3 text-center font-medium text-[var(--text-muted)]">
            Step {step} of 3
          </p>
          <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-300 ease-out rounded-full"
              style={{ width: `${(step / 3) * 100}%`, background: 'var(--primary-solid)' }}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {/* Step 1: Age Group */}
          {step === 1 && (
            <PageTransition variant="slide" key="step1">
              <h1 className="text-2xl font-bold mb-2 text-foreground text-center">
                What's your age group?
              </h1>
              <p className="mb-8 text-[var(--text-muted)] text-sm text-center">
                This helps us tailor exercises to your biomechanical needs
              </p>

              <div className="grid grid-cols-2 gap-2">
                {ageGroups.map((group) => {
                  const Icon = group.icon;
                  const isSelected = formData.ageGroup === group.value;
                  return (
                    <button
                      key={group.value}
                      onClick={() => setFormData({ ...formData, ageGroup: group.value })}
                      className="h-32 rounded-xl flex flex-col items-center justify-center gap-3 transition-all border-2"
                      style={{
                      borderColor: isSelected ? 'var(--accent-text)' : 'var(--text-muted)',
                      background: isSelected ? 'var(--accent-surface)' : 'var(--bg-card)',
                      boxShadow: isSelected ? 'none' : '0 1px 3px rgba(0,0,0,0.02)',
                      transform: isSelected ? 'scale(0.98)' : 'scale(1)',
                    }}
                    >
                      <Icon size={32} strokeWidth={2} />
                      <span className="font-semibold">{group.label}</span>
                    </button>
                  );
                })}
              </div>
            </PageTransition>
          )}

          {/* Step 2: Sex */}
          {step === 2 && (
            <PageTransition variant="slide" key="step2">
              <h1 className="text-2xl font-bold mb-2 text-foreground">
                Biological Sex
              </h1>
              <p className="mb-8 text-muted-foreground">
                Used for biomechanical analysis only. This information is kept private and secure.
              </p>

              <div className="space-y-4">
                {sexOptions.map((option) => {
                  const isSelected = formData.sex === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setFormData({ ...formData, sex: option.value })}
                      className="w-full h-16 rounded-xl flex items-center justify-center transition-all font-semibold border-2"
                      style={{
                        borderColor: isSelected ? '#4682B4' : '#E2E8F0',
                        background: isSelected ? 'rgba(70, 130, 180, 0.08)' : '#FFFFFF',
                        color: isSelected ? '#4682B4' : '#1E293B',
                        transform: isSelected ? 'scale(0.98)' : 'scale(1)',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </PageTransition>
          )}

          {/* Step 3: Height & Weight */}
          {step === 3 && (
            <PageTransition variant="slide" key="step3">
              <h1 className="text-2xl font-bold mb-2 text-foreground">
                Body Measurements
              </h1>
              <p className="mb-8 text-muted-foreground">
                Help us calculate your baseline metrics
              </p>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="height" className="block text-sm font-medium mb-1.5">
                      Height (cm)
                    </label>
                    <Input
                      id="height"
                      type="number"
                      placeholder="170"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="weight" className="block text-sm font-medium mb-1.5">
                      Weight (kg)
                    </label>
                    <Input
                      id="weight"
                      type="number"
                      placeholder="70"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    />
                  </div>
                </div>

                {/* Live BMI Display */}
                <div 
                  className="p-5 rounded-xl border-2 transition-all duration-300"
                  style={{
                    borderColor: bmi ? 'rgba(70, 130, 180, 0.4)' : '#E2E8F0',
                    borderStyle: bmi ? 'solid' : 'dashed',
                    background: bmi ? 'rgba(70, 130, 180, 0.04)' : 'transparent',
                    opacity: bmi ? 1 : 0.5,
                  }}
                >
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Body Mass Index (BMI)
                  </p>
                  {bmi ? (
                    <div className="flex items-end gap-2">
                       <p className="text-3xl font-bold" style={{ color: '#4682B4' }}>{bmi}</p>
                       <span className="text-sm pb-1 font-medium tracking-wide" style={{ color: 'rgba(70, 130, 180, 0.8)' }}>
                        {parseFloat(bmi) < 18.5 ? 'UNDERWEIGHT' : parseFloat(bmi) < 25 ? 'HEALTHY RANGE' : parseFloat(bmi) < 30 ? 'OVERWEIGHT' : 'OBESE'}
                       </span>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-muted-foreground">--.-</p>
                  )}
                </div>
              </div>
            </PageTransition>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-4">
          <Button
            onClick={handleContinue}
            disabled={!isStepComplete() || isSaving}
            isLoading={isSaving}
            className="w-full h-14 text-lg bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)]"
          >
            {step === 3 ? 'Continue to Camera Setup' : 'Continue'}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}