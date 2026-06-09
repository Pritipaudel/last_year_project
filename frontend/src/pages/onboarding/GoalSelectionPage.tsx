import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell, Scale, StretchHorizontal, Activity, Stethoscope, Lock } from "lucide-react";
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
    <PageTransition variant="slide" className="flex flex-col h-full">
      <div className="mb-6">
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
                    borderColor: isSelected ? '#4682B4' : isLocked ? '#F59E0B' : '#E2E8F0',
                    background: isSelected ? 'rgba(70, 130, 180, 0.05)' : isLocked ? 'rgba(245, 158, 11, 0.04)' : '#FFFFFF',
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="flex justify-center items-center h-12 w-12 rounded-full flex-shrink-0"
                      style={{
                        background: isSelected ? '#4682B4' : isLocked ? '#FEF3C7' : '#F1F5F9',
                        color: isSelected ? '#FFFFFF' : isLocked ? '#D97706' : '#64748B',
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
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="pt-8 flex justify-between border-t border-border mt-auto">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button 
          onClick={handleContinue}
          disabled={!selectedGoal || isSaving}
          isLoading={isSaving}
        >
          Complete Setup
        </Button>
      </div>
    </PageTransition>
  );
}
