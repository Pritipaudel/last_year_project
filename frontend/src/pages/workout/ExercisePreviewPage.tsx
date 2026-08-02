import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Info, Dumbbell } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageTransition } from "@/components/common/PageTransition";
import { exerciseService, Exercise } from "@/services/exerciseService";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

// -----------------------------------------------------------------------
// Per-exercise instructions, safety cues, and camera position hints.
// Keyed on a lowercase substring of the exercise name.
// -----------------------------------------------------------------------
interface ExerciseGuide {
  safetyTip: string;
  steps: string[];
  cameraTip: string;
}

function getExerciseGuide(exerciseName: string): ExerciseGuide {
  const name = exerciseName.toLowerCase();

  if (name.includes("squat")) {
    return {
      safetyTip: "Keep your knees over your toes. Don't let your back round.",
      steps: [
        "Stand with feet shoulder-width apart.",
        "Lower your hips like sitting on a chair, chest up.",
        "Go down until thighs are parallel or deeper.",
        "Push through your heels to stand back up.",
      ],
      cameraTip: "Camera at hip height, 1.5 m away — full body in frame.",
    };
  }

  if (name.includes("bicep") || name.includes("curl")) {
    return {
      safetyTip: "Pin elbows to your sides. Don't swing your back.",
      steps: [
        "Hold dumbbells at your sides, palms forward.",
        "Keep elbows still and curl weights up to your shoulders.",
        "Squeeze at the top for one second.",
        "Slowly lower back down — fully extend each time.",
      ],
      cameraTip: "Stand 1–1.5 m from camera — both arms must be visible.",
    };
  }

  if (name.includes("tree") || name.includes("vrksasana")) {
    return {
      safetyTip: "Never press your foot into your knee. Use a wall if needed.",
      steps: [
        "Stand on one leg, arms at your sides.",
        "Place the other foot on your thigh, calf, or ankle.",
        "Press your standing foot into the floor for balance.",
        "Bring hands to chest or raise overhead.",
        "Fix your gaze on one spot. Hold, then switch legs.",
      ],
      cameraTip: "Camera at chest height, 1.5 m away — full body visible.",
    };
  }

  if (name.includes("butterfly") || name.includes("baddha")) {
    return {
      safetyTip: "Never force your knees down. Let gravity open your hips gently.",
      steps: [
        "Sit on the floor, press soles of your feet together.",
        "Pull your heels close to your body.",
        "Sit tall — don't hunch your back.",
        "Let your knees fall naturally. Breathe and hold.",
      ],
      cameraTip: "Camera at floor level, 1 m away — torso and legs visible.",
    };
  }

  return {
    safetyTip: "Move slowly and breathe steadily. Stop if you feel sharp pain.",
    steps: [
      "Get into the starting position.",
      "Keep your core tight and back straight.",
      "Perform the movement with full control.",
      "Return to start and repeat.",
    ],
    cameraTip: "Ensure your full body is visible in frame.",
  };
}

export function ExercisePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExercise = async () => {
      if (!id) return;
      try {
        const data = await exerciseService.getExerciseById(id);
        if (data) setExercise(data);
      } catch (error) {
        console.error("Failed to load exercise", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchExercise();
  }, [id]);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!exercise) return <div className="p-8 text-center">Exercise not found</div>;

  const guide = getExerciseGuide(exercise.name);

  return (
    <PageTransition variant="slide" className="flex flex-col min-h-screen">
      <Header title="Exercise Detail" showBack onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto">
        {/* Hero image — no video overlay */}
        <div
          className="h-64 w-full bg-cover bg-center relative"
          style={{ backgroundImage: `url(${exercise.imageUrl})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 flex gap-2">
            <Badge variant="secondary">{exercise.difficulty}</Badge>
            <Badge variant="outline" className="text-white border-white/50">
              {exercise.muscleGroup}
            </Badge>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Title */}
          <h2 className="text-3xl font-bold">{exercise.name}</h2>

          {/* Safety tip */}
          <div className="bg-[var(--primary-solid)]/10 rounded-xl p-4 flex gap-3 text-sm">
            <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-[var(--text-main)]/80">{guide.safetyTip}</p>
          </div>

          {/* Step-by-step instructions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">How to Perform</h3>
            <ol className="space-y-3">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[var(--primary-solid)] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-[var(--text-muted)] text-sm leading-relaxed">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Camera position tip */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3 text-sm">
            <Dumbbell className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-700 dark:text-amber-300 mb-0.5">
                Camera Position
              </p>
              <p className="text-amber-700/80 dark:text-amber-400/80">{guide.cameraTip}</p>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => navigate(`/workout/active?id=${exercise.id}`)}
          >
            Begin Exercise
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
