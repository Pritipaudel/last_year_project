import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Calendar, Play } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/common/PageTransition";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { exerciseService, Exercise, WorkoutSession } from "@/services/exerciseService";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [todayExercise, setTodayExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [exData, sessionData] = await Promise.all([
          exerciseService.getExercises(),
          exerciseService.getSessions(),
        ]);
        
        setExercises(exData);
        setRecentSessions(sessionData);
        
        // Pick Squat as "Today's Plan" if available, otherwise first exercise
        const squat = exData.find(ex => ex.name.toLowerCase().includes('squat'));
        setTodayExercise(squat || exData[0] || null);
        
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading dashboard..." />;
  }

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title="Dashboard" />
      
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Hello, {user?.name?.split(' ')[0] || 'User'}! 👋
          </h2>
          <p className="text-muted-foreground">Ready for your workout today?</p>
        </div>

        {todayExercise ? (
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <Badge variant="secondary" className="mb-2">Today's Plan</Badge>
                  <h3 className="text-xl font-bold">{todayExercise.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {todayExercise.muscleGroup} • {todayExercise.difficulty}
                  </p>
                </div>
                <div className="hidden sm:flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Activity className="h-8 w-8" />
                </div>
              </div>
              <Button 
                className="w-full sm:w-auto" 
                leftIcon={<Play className="h-4 w-4" />}
                onClick={() => navigate(`/exercises/${todayExercise.id}`)}
              >
                Start Workout
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            Complete your profile to see personalized workouts!
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Workouts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentSessions.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Streak</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-emerald-600">
                {recentSessions.length > 0 ? '1' : '0'}
              </div>
              <span className="text-sm text-muted-foreground">days</span>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <Link to="/history" className="text-sm text-primary font-medium hover:underline">View all</Link>
          </div>
          
          <div className="space-y-3">
            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
                <Card key={session.id} variant="default" className="py-2">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{session.exercise_name || session.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()} • {session.duration_minutes} mins
                        </p>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-primary">
                      {session.reps} reps
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed text-sm">
                No recent workouts found. Start your first session today!
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
