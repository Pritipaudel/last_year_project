import { useState, useEffect } from "react";
import { Calendar, Activity } from "lucide-react";
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
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title="Workout History" />
      
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex gap-4 mb-6">
          <Card className="flex-1 bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{sessions.length}</div>
              <div className="text-xs opacity-80 uppercase tracking-wider">Workouts</div>
            </CardContent>
          </Card>
          <Card className="flex-1 border-primary/10">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{totalMinutes}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Active Mins</div>
            </CardContent>
          </Card>
        </div>

        {sessions.length > 0 ? (
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {sessions.map((session, i) => (
              <div key={session.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary text-primary-foreground shadow-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-transform group-hover:scale-110">
                  <Activity className="h-4 w-4" />
                </div>
                <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:border-primary/50 transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-foreground">
                        {session.exercise_name || session.title}
                      </h4>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-[10px] bg-primary/5 hover:bg-primary/5">
                        <Calendar className="h-3 w-3 mr-1 text-primary" /> {session.duration_minutes} mins
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] bg-muted/50 hover:bg-muted/50">
                        {session.reps} reps
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4 bg-muted/10 rounded-2xl border border-dashed text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No workout history found yet.</p>
            <p className="text-sm mt-1">Complete a workout to see it here!</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
