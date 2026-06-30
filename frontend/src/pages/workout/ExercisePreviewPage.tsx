import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Play, Info } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageTransition } from "@/components/common/PageTransition";
import { exerciseService, Exercise } from "@/services/exerciseService";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

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

  return (
    <PageTransition variant="slide" className="flex flex-col min-h-screen">
      <Header title="Exercise Detail" showBack onBack={() => navigate(-1)} />
      
      <div className="flex-1 overflow-y-auto">
        <div 
          className="h-64 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${exercise.imageUrl})` }}
        >
          {/* Play button overlay for video */}
          <div className="h-full w-full bg-black/30 flex items-center justify-center backdrop-blur-[2px]">
            <Button variant="secondary" size="icon" className="h-16 w-16 rounded-full opacity-90">
              <Play className="h-6 w-6 ml-1" />
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div>
            <div className="flex gap-2 mb-2">
              <Badge variant="secondary">{exercise.difficulty}</Badge>
              <Badge variant="outline">{exercise.muscleGroup}</Badge>
            </div>
            <h2 className="text-3xl font-bold mt-2">{exercise.name}</h2>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 flex gap-3 text-sm">
            <Info className="h-5 w-5 text-primary flex-shrink-0" />
            <p className="text-muted-foreground">
              Keep your core tight and your back straight during the entire movement to prevent injury.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Instructions</h3>
            <ol className="list-decimal list-outside ml-4 space-y-3 text-muted-foreground">
              <li>Position your body properly before starting.</li>
              <li>Lower yourself steadily while inhaling.</li>
              <li>Push back up explosively while exhaling.</li>
              <li>Repeat for the designated number of repetitions.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-background border-t p-4 pb-safe-area shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <Button 
          className="w-full" 
          size="lg"
          onClick={() => navigate(`/workout/active?id=${exercise.id}`)}
        >
          Begin Exercise
        </Button>
      </div>
    </PageTransition>
  );
}
