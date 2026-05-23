import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Pause, Play, Square, SkipForward } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";

export function ActiveWorkoutPage() {
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isPaused]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleFinish = () => {
    navigate("/workout/summary");
  };

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen bg-surface-base">
      <Header title="Workout in Progress" />
      
      <div className="flex-1 flex flex-col justify-center items-center p-6 space-y-12">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Current Exercise</p>
          <h2 className="text-4xl font-bold mb-8 text-primary">Push-ups</h2>
          
          <div className="text-7xl font-mono tracking-tighter tabular-nums mb-4">
            {formatTime(seconds)}
          </div>
          <p className="font-medium text-muted-foreground">Elapsed Time</p>
        </div>

        <div className="flex items-center gap-6">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-16 w-16 rounded-full border-2"
            onClick={handleFinish}
          >
            <Square className="h-6 w-6 text-destructive" />
          </Button>

          <Button 
            size="icon" 
            className="h-20 w-20 rounded-full shadow-lg"
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? <Play className="h-8 w-8 ml-1" /> : <Pause className="h-8 w-8" />}
          </Button>

          <Button 
            variant="outline" 
            size="icon" 
            className="h-16 w-16 rounded-full border-2"
          >
            <SkipForward className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
