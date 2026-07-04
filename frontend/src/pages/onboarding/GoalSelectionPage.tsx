import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell, Scale, StretchHorizontal, Activity, Stethoscope, Lock,Check,ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/common/PageTransition";
import { useOnboardingStore } from "@/store/onboardingStore";
import { biometricService } from "@/lib/api";
import { cn } from "@/lib/utils";

const GOALS = [
  { id: "build-muscle", title: "Build Muscle", description: "Increase strength and muscle mass", icon: Dumbbell },
  { id: "lose-weight", title: "Lose Weight", description: "Burn calories effectively", icon: Scale },
  { id: "improve-flexibility", title: "Improve Flexibility", description: "Enhance range of motion", icon: StretchHorizontal },
  { id: "stay-active", title: "Stay Active", description: "Maintain general fitness", icon: Activity },
  { id: "doctor-rehab", title: "Doctor-Guided Rehab", description: "Supervised recovery program", icon: Stethoscope, isLocked: true },
];

export function GoalSelectionPage() {
  const navigate = useNavigate();
  const { setField } = useOnboardingStore();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    if (selectedGoal) {
      setIsSaving(true);
      try {
        await biometricService.saveProfile({
          goal: selectedGoal
        });
        setField("selectedGoal", selectedGoal);
        navigate("/onboarding/goals-confirmation");
      } catch (e) {
        console.error("Failed to save goal", e);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <PageTransition variant="slide" className="flex flex-col h-full ">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Select Your Goal</h2>
        <p className="text-muted-foreground">What is your primary focus right now?</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid gap-3 pb-6">
          {GOALS.map((goal, index) => {
            const Icon = goal.icon;
            const isSelected = selectedGoal === goal.id;
            const isLocked = goal.isLocked;
            
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
              >
                <Card
                  variant="interactive"
                  onClick={() => !isLocked && setSelectedGoal(goal.id)}
                  className={cn(
                    "p-4 transition-all relative overflow-hidden",
                    isSelected && "ring-1 ring-primary",
                    isLocked && "opacity-75 cursor-not-allowed"
                  )}
                  style={{
                    borderColor: isSelected ? 'var(--accent-text)' : isLocked ? 'var(--coral-text)' : 'var(--border-card)',
                    background: isSelected ? 'var(--accent-surface)' : isLocked ? 'var(--coral-surface)' : 'var(--bg-card)',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="flex justify-center items-center h-12 w-12 rounded-full flex-shrink-0"
                      style={{
                        background: isSelected ? 'var(--primary-solid)' : isLocked ? 'var(--coral-surface)' : 'var(--border-card)',
                        color: isSelected ? 'var(--bg-card)' : isLocked ? 'var(--coral-text)' : 'var(--text-muted)',
                      }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        {goal.title}
                        {isLocked && <Lock size={14} style={{ color: '#D97706' }} />}
                      </h3>
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    </div>
                    {isSelected && !isLocked && (
                    <div 
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ background: 'var(--primary-solid)' }}
                    >
                      <Check size={14} strokeWidth={3} />
                    </div>
                  )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="pt-8 flex justify-between border-t border-border mt-auto">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} strokeWidth={2.5}></ArrowLeft>
          <span>Back</span>
        </Button>
        <Button 
          onClick={handleContinue}
          disabled={!selectedGoal || isSaving}
          isLoading={isSaving}
          className="h-12 px-6 rounded-full bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <span>Complete Setup</span>
          <Check size={16} strokeWidth={2.5}></Check>
        </Button>
      </div>
    </PageTransition>
  );
}