import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2, Zap, Clock, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageTransition } from "@/components/common/PageTransition";

export function SessionSummaryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { exerciseName, reps, duration, isStaticHold, treeHoldLeft, treeHoldRight } = location.state || {
    exerciseName: "Session",
    reps: 0,
    duration: "00:00",
    isStaticHold: false,
    treeHoldLeft: 0,
    treeHoldRight: 0
  };

  return (
    <PageTransition variant="scale" className="flex flex-col min-h-screen bg-neutral-50 dark:bg-black p-6">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 max-w-md mx-auto w-full">
        
        <div className="text-center space-y-4">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-2 shadow-2xl">
            <CheckCircle2 size={40} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-foreground uppercase tracking-tighter italic">Set Complete!</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-[0.3em] mt-2">{exerciseName} Finished</p>
          </div>
        </div>

        {/* RESULTS GRID */}
        <div className="grid grid-cols-2 gap-4 w-full">
          {isStaticHold ? (
            <>
              <Card className="bg-white dark:bg-neutral-900 border-none shadow-xl shadow-black/5 dark:shadow-none">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                    <Zap size={24} />
                  </div>
                  <div className="text-3xl font-black text-foreground">{Math.floor(treeHoldLeft)}s</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2 opacity-50">L Leg Hold</div>
                </CardContent>
              </Card>
              <Card className="bg-white dark:bg-neutral-900 border-none shadow-xl shadow-black/5 dark:shadow-none">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                    <Zap size={24} />
                  </div>
                  <div className="text-3xl font-black text-foreground">{Math.floor(treeHoldRight)}s</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2 opacity-50">R Leg Hold</div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-white dark:bg-neutral-900 border-none shadow-xl shadow-black/5 dark:shadow-none">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <Zap size={24} />
                </div>
                <div className="text-3xl font-black text-foreground">{reps}</div>
                <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2 opacity-50">Total Reps</div>
              </CardContent>
            </Card>
          )}
          
          <Card className={`${isStaticHold ? 'col-span-2' : ''} bg-white dark:bg-neutral-900 border-none shadow-xl shadow-black/5 dark:shadow-none`}>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500">
                <Clock size={24} />
              </div>
              <div className="text-3xl font-black text-foreground">{duration}</div>
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-2 opacity-50">Duration</div>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 overflow-hidden relative rounded-[2rem]">
          <div className="absolute -right-4 -top-4 h-24 w-24 bg-primary/10 rounded-full blur-3xl" />
          <CardContent className="p-8 flex items-center gap-6 relative z-10">
            <div className="h-16 w-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 -rotate-6 shrink-0">
              <Trophy size={32} />
            </div>
            <div>
              <p className="font-black text-xl text-foreground uppercase italic tracking-tight italic">Elite Effort!</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your performance has been logged to your <span className="text-primary font-bold">training history</span>. Keep pushing!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-auto pt-8 flex flex-col gap-4 pb-10">
        <Button 
          className="w-full h-16 rounded-[2rem] text-xl font-black shadow-2xl shadow-primary/20 uppercase italic transition-transform active:scale-95" 
          size="lg"
          onClick={() => navigate("/dashboard")}
        >
          Finish & Return
          <ArrowRight className="ml-2 h-6 w-6" />
        </Button>
      </div>
    </PageTransition>
  );
}
