import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2, Flame, Clock, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageTransition } from "@/components/common/PageTransition";

export function SessionSummaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get data passed from ActiveWorkoutPage
  const { exerciseName, reps, duration } = location.state || {
    exerciseName: "Session",
    reps: 0,
    duration: "00:00"
  };

  // Mock calorie calculation (usually this would come from a formula or backend)
  const calories = Math.round(reps * 0.5 * 10); 

  return (
    <PageTransition variant="scale" className="flex flex-col min-h-screen bg-surface-base p-6">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 max-w-md mx-auto w-full">
        
        <div className="text-center space-y-4">
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2 shadow-inner">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Set Complete!</h1>
          <p className="text-muted-foreground font-medium">{exerciseName} training</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <Card className="bg-card border-none shadow-sm">
            <CardContent className="p-5 flex flex-col items-center justify-center text-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="text-2xl font-black">{duration}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Duration</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-none shadow-sm">
            <CardContent className="p-5 flex flex-col items-center justify-center text-center">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center mb-3">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-2xl font-black">{calories}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Calories</div>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/10 shadow-lg shadow-primary/5 overflow-hidden relative">
          <div className="absolute -right-4 -top-4 h-24 w-24 bg-primary/10 rounded-full blur-2xl" />
          <CardContent className="p-6 flex items-center gap-5 relative z-10">
            <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-sm rotate-3">
              <Trophy className="h-8 w-8" />
            </div>
            <div>
              <p className="font-bold text-lg text-foreground">Nice Work!</p>
              <p className="text-sm text-muted-foreground">
                You successfully completed <span className="font-bold text-primary">{reps} reps</span> of {exerciseName}.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-auto pt-8 flex flex-col gap-3">
        <Button 
          className="w-full h-14 rounded-2xl text-lg shadow-xl shadow-primary/20" 
          size="lg"
          onClick={() => navigate("/dashboard")}
          rightIcon={<ArrowRight className="h-5 w-5" />}
        >
          Return to Dashboard
        </Button>
        <Button 
          variant="outline"
          className="w-full h-12 rounded-2xl border-2" 
          onClick={() => navigate("/exercises")}
        >
          Start New Exercise
        </Button>
      </div>
    </PageTransition>
  );
}
