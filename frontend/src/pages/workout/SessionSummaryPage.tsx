import { useNavigate } from "react-router-dom";
import { CheckCircle2, Flame, Clock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageTransition } from "@/components/common/PageTransition";

export function SessionSummaryPage() {
  const navigate = useNavigate();

  return (
    <PageTransition variant="scale" className="flex flex-col min-h-screen bg-primary/5 p-6">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 max-w-md mx-auto w-full">
        
        <div className="text-center space-y-4">
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Workout Complete!</h1>
          <p className="text-muted-foreground">Upper Body Strength training</p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <Card className="bg-background border-none shadow-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <Clock className="mb-2 h-6 w-6 text-primary" />
              <div className="text-2xl font-bold">45</div>
              <div className="text-xs text-muted-foreground">Minutes</div>
            </CardContent>
          </Card>
          
          <Card className="bg-background border-none shadow-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <Flame className="mb-2 h-6 w-6 text-orange-500" />
              <div className="text-2xl font-bold">320</div>
              <div className="text-xs text-muted-foreground">Calories</div>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-primary-foreground">New Personal Record!</p>
              <p className="text-sm text-primary-foreground/80">You completed 20 push-ups consecutively.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-auto pt-8">
        <Button 
          className="w-full" 
          size="lg"
          onClick={() => navigate("/dashboard")}
        >
          Return to Dashboard
        </Button>
      </div>
    </PageTransition>
  );
}
