import { useState, useEffect } from "react";
import { Calendar, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageTransition } from "@/components/common/PageTransition";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { exerciseService, WorkoutSession } from "@/services/exerciseService";

export function HistoryPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await exerciseService.getSessions();
        setSessions(data);
      } catch (error) {
        console.error("Failed to load workout history", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading your history..." />;
  }

  const totalMinutes = sessions.reduce((acc, s) => acc + s.duration_minutes, 0);

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-24 bg-neutral-50 dark:bg-black">
      <Header title="Workout Statistics" />
      
      <div className="p-4 sm:p-6 space-y-8">
        {/* STATS SUMMARY */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-primary text-primary-foreground border-none shadow-2xl shadow-primary/20 overflow-hidden relative group">
            <div className="absolute -right-4 -top-4 bg-white/10 h-24 w-24 rounded-full transition-transform group-hover:scale-125 duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="text-3xl font-black">{sessions.length}</div>
              <div className="text-[10px] opacity-70 uppercase font-bold tracking-[0.2em] mt-1">Sessions</div>
            </CardContent>
          </Card>
          <Card className="border-none bg-white dark:bg-neutral-900 shadow-sm overflow-hidden relative group">
            <div className="absolute -right-4 -top-4 bg-primary/5 h-24 w-24 rounded-full transition-transform group-hover:scale-125 duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="text-3xl font-black text-primary">{totalMinutes}</div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mt-1">Active Mins</div>
            </CardContent>
          </Card>
        </div>

        {/* TIMELINE */}
        <div className="space-y-4">
          <h3 className="text-xs uppercase font-black text-neutral-400 tracking-widest pl-1">Recent Activity</h3>
          
          {sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.map((session) => {
                const errors = session.metadata?.form_errors || [];
                const hasErrors = errors.length > 0;
                
                return (
                  <Card key={session.id} className="group hover:border-primary/30 transition-all border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex">
                        {/* LEFT STRIP */}
                        <div className={`w-1.5 ${hasErrors ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        
                        <div className="flex-1 p-5">
                          <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-primary uppercase tracking-tighter">
                                {session.workout_type}
                              </div>
                              <h4 className="font-black text-xl tracking-tight text-neutral-900 dark:text-white uppercase italic">
                                {session.exercise_name || session.title}
                              </h4>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-black text-neutral-400 block uppercase">
                                {new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                              <span className="text-[10px] font-medium text-neutral-300">
                                {new Date(session.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-neutral-50 dark:bg-black/40 rounded-xl p-3 border border-neutral-100 dark:border-white/5">
                              <span className="text-[8px] uppercase font-bold text-neutral-400 block mb-1">Reps</span>
                              <span className="text-lg font-black">{session.reps}</span>
                            </div>
                            <div className="bg-neutral-50 dark:bg-black/40 rounded-xl p-3 border border-neutral-100 dark:border-white/5">
                              <span className="text-[8px] uppercase font-bold text-neutral-400 block mb-1">Time</span>
                              <span className="text-lg font-black">{session.duration_minutes}m</span>
                            </div>
                            <div className="bg-neutral-50 dark:bg-black/40 rounded-xl p-3 border border-neutral-100 dark:border-white/5">
                              <span className="text-[8px] uppercase font-bold text-neutral-400 block mb-1">Result</span>
                              <div className="flex items-center gap-1">
                                {hasErrors ? (
                                  <>
                                    <AlertCircle className="h-3 w-3 text-amber-500" />
                                    <span className="text-[10px] font-bold text-white">Adjust</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                    <span className="text-[10px] font-bold text-white">Focus</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {hasErrors && (
                            <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-dashed border-neutral-100 dark:border-white/5 lg:hidden">
                               <span className="text-[9px] font-bold text-neutral-400">Notes:</span>
                               <span className="text-[9px] text-neutral-500 italic">
                                  {errors.length} form corrections suggested during session.
                               </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 px-8 bg-white dark:bg-neutral-900 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800">
              <Activity className="h-16 w-16 mx-auto mb-6 text-neutral-200" />
              <h3 className="text-lg font-bold text-neutral-400">Fresh start!</h3>
              <p className="text-sm text-neutral-500 mt-2">Your exercise history will appear here once you complete your first AI-guided session.</p>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
