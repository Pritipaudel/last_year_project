import { useNavigate } from "react-router-dom";
import { CheckCircle2, User, Ruler, Target, Camera,ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { useOnboardingStore } from "@/store/onboardingStore";

const GOAL_LABELS: Record<string, string> = {
  "build-muscle": "Build Muscle",
  "lose-weight": "Lose Weight",
  "improve-flexibility": "Improve Flexibility",
  "stay-active": "Stay Active",
  "doctor-rehab": "Doctor-Guided Rehab",
  // Legacy goal IDs
  "rehab": "Rehabilitation",
  "strength": "Build Strength",
  "cardio": "Cardiovascular",
  "weight": "Weight Management",
};

export function GoalsConfirmationPage() {
  const navigate = useNavigate();
  const { ageGroup, sex, height, weight, bmi, selectedGoal, photoTaken, cameraAllowed } = useOnboardingStore();

  const summaryItems = [
    {
      icon: User,
      label: "Age Range",
      value: ageGroup || "Not set",
    },
    {
      icon: Ruler,
      label: "Measurements",
      value: height && weight
        ? `${height}cm / ${weight}kg${bmi ? ` (BMI: ${bmi})` : ""}`
        : "Not set",
    },
    {
      icon: Target,
      label: "Selected Goal",
      value: selectedGoal ? (GOAL_LABELS[selectedGoal] || selectedGoal) : "Not set",
    },
    {
      icon: Camera,
      label: "Body Scan",
      value: photoTaken
        ? "Completed"
        : cameraAllowed
          ? "Camera allowed"
          : "Skipped",
    },
  ];

  return (
    <PageTransition variant="slide" className="flex flex-col h-full">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">Confirm Your Profile</h2>
        <p className="text-muted-foreground">
          Review your selections before we create your personalized plan.
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {summaryItems.map((item, index) => {
          const Icon = item.icon;
          const isSet = item.value !== "Not set" && item.value !== "Skipped";
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={{
                background: 'var(--bg-card)',
                borderColor: isSet ? 'var(--primary-light)' : 'var(--border-card)',
              }}
            >
              <div
                className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: isSet ? 'var(--accent-surface)' : 'var(--border-card)',
                }}
              >
                <Icon size={20} style={{ color: isSet ? "var(--accent-text)" : "var(--text-muted)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </p>
                <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
                  {item.value}
                </p>
              </div>
              {isSet && (
                <CheckCircle2 size={20} style={{ color: "#10B981" }} className="flex-shrink-0" />
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="pt-8 flex justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} strokeWidth={2.5}></ArrowLeft>
          <span className="px-2">Back</span>
        </Button>
        <Button
          onClick={() => navigate("/onboarding/complete")}
          disabled={!selectedGoal}
          className="h-12 px-6 rounded-full bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          Start My Plan
        </Button>
      </div>
    </PageTransition>
  );
}
