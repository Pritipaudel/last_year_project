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

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
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

        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <Badge variant="secondary" className="mb-2">Today's Plan</Badge>
                <h3 className="text-xl font-bold">Full Body Strength</h3>
                <p className="text-sm text-muted-foreground mt-1">45 mins • Intermediate • 5 exercises</p>
              </div>
              <div className="hidden sm:flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Activity className="h-8 w-8" />
              </div>
            </div>
            <Button 
              className="w-full sm:w-auto" 
              leftIcon={<Play className="h-4 w-4" />}
              onClick={() => navigate("/exercises")}
            >
              Start Workout
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Weekly Goal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3<span className="text-sm text-muted-foreground font-normal">/5 days</span></div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[60%]" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Streak</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center space-x-2">
              <div className="text-2xl font-bold text-emerald-600">4</div>
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
            {[1, 2, 3].map((i) => (
              <Card key={i} variant="default" className="py-2">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Upper Body Focus</p>
                      <p className="text-xs text-muted-foreground">Yesterday • 30 mins</p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-primary">
                    320 kcal
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
