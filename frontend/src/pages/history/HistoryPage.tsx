import { useState, useEffect } from "react";
import { Calendar, Activity, CheckCircle2, AlertCircle,History,Clock, Trophy } from "lucide-react";
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
          <Card className="md:col-span-1 bg-[var(--primary-solid)] rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div className="bg-[var(--bg-dashboard)]/60 dark:bg-emerald-950/40 p-2.5 rounded-full flex items-center justify-center">
                <Trophy className="h-5 w-5 text-[var(--primary-light)] dark:text-emerald-400" />
              </div>
              <span className="text-xs uppercase font-bold text-[var(--bg-dashboard)] tracking-wider">
                sessions
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-[var(--bg-dashboard)] tracking-tight">
                {totalMinutes}
              </span>
              <span className="text-sm font-medium text-[var(--border-card)]/60">
                mins
              </span>
            </div>
          </Card>
          <Card className="md:col-span-1 bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <span className="text-xs uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                Active Mins
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-neutral-800 dark:text-neutral-100 tracking-tight">
                {totalMinutes}
              </span>
              <span className="text-sm font-medium text-neutral-400">
                mins
              </span>
            </div>
          </Card>
        </div>

        {/* TIMELINE */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        {/* HEADER */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-bold text-sm">
            <History className="h-4 w-4 text-neutral-500" />
            <span>Recent Activity</span>
          </div>
          <span className="text-xs text-neutral-400 font-medium">
            {sessions.length} {sessions.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {/* SESSIONS LIST */}
        {sessions.length > 0 ? (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sessions.map((session) => {
              const errors = session.metadata?.form_errors || [];
              const hasErrors = errors.length > 0;
              
              return (
                <div key={session.id} className="group relative flex items-center justify-between p-6 hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                  {/* LEFT INDICATOR STRIP */}
                  <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${hasErrors ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  
                  {/* MAIN CONTENT BLOCK */}
                  <div className="flex items-center justify-between w-full pl-3 pr-2">
                    
                    {/* LEFT SIDE: EXERCISE INFO */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40 px-2 py-0.5 rounded uppercase tracking-wider">
                          {session.workout_type}
                        </span>
                        <span className="text-xs font-medium text-neutral-400">
                          {new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(session.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-neutral-800 dark:text-neutral-100">
                        {session.exercise_name || session.title}
                      </h4>
                    </div>

                    {/* RIGHT SIDE: METRICS COLUMNS */}
                    <div className="flex items-center gap-8 text-center">
                      
                      {/* REPS / HOLD */}
                      <div className="w-12">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider mb-0.5">
                          {session.metadata?.pose_type === 'static_hold' ? 'Hold' : 'Reps'}
                        </span>
                        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                          {session.metadata?.pose_type === 'static_hold'
                            ? `${Math.max(session.metadata.left_leg_hold_seconds || 0, session.metadata.right_leg_hold_seconds || 0)}s`
                            : session.reps || 0}
                        </span>
                      </div>

                      {/* TIME */}
                      <div className="w-12">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider mb-0.5">Time</span>
                        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                          {session.duration_minutes}m
                        </span>
                      </div>

                      {/* RESULT */}
                      <div className="w-12 flex flex-col items-center">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider mb-1">Result</span>
                        {hasErrors ? (
                          <AlertCircle className="h-5 w-5 text-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-full" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 rounded-full" />
                        )}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )  : (
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
