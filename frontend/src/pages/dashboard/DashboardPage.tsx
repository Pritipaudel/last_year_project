import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Calendar, Play, Dumbbell, ArrowRight, Sparkles, ChevronDown, Trophy, User, Flame } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/common/PageTransition";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { exerciseService, Exercise, WorkoutSession } from "@/services/exerciseService";
import { biometricService } from "@/services/biometricService";

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [todayExercise, setTodayExercise] = useState<Exercise | null>(null);

  const CATEGORIES = [
    { id: "build-muscle", label: "Build Muscle" },
    { id: "lose-weight", label: "Lose Weight" },
    { id: "stay-active", label: "Stay Active" },
    { id: "improve-flexibility", label: "Flexibility" },
    { id: "doctor-rehab", label: "Rehab" },
  ];

  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [isUpdatingGoal, setIsUpdatingGoal] = useState(false);

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [exData, sessionData, profileData] = await Promise.all([
          exerciseService.getExercises(),
          exerciseService.getSessions(),
          biometricService.getProfile(),
        ]);

        setExercises(exData);
        setRecentSessions(sessionData);
        if (profileData && profileData.goal) {
          const parsed = profileData.goal.split(',').map(s => s.trim()).filter(Boolean);
          setSelectedGoals(parsed);
        }
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

  const toggleCategory = async (catId: string) => {
    if (isUpdatingGoal) return;
    const updated = selectedGoals.includes(catId)
      ? selectedGoals.filter(c => c !== catId)
      : [...selectedGoals, catId];

    setSelectedGoals(updated);
    setIsUpdatingGoal(true);
    try {
      await biometricService.updateProfile({ goal: updated.join(', ') });
      const data = await exerciseService.getExercises();
      setExercises(data || []);
    } catch (e) {
      console.error("Failed to update goals", e);
    } finally {
      setIsUpdatingGoal(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading dashboard..." />;
  }

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen bg-[var(--bg-dashboard)] pb-12">
      <Header title="Dashboard" />
      {/* first row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
        <Card className="rounded-2xl p-6 md:col-span-2 justify-between relative overflow-hidden" style={{
          background: "linear-gradient(135deg, #3d8b78 0%, #72b8a9 100%)",
        }}>
          <div className="absolute -top-6 -right-6 rounded-full opacity-20" style={{ width: 120, height: 120, background: "#fff" }} />
          <div className="absolute -bottom-8 -left-4 rounded-full opacity-10" style={{ width: 100, height: 100, background: "#fff" }} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} color="rgba(255,255,255,0.85)" />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)" }}>
                Welcome back
              </span>
            </div>
            <h2 className="text-2xl font-extrabold mt-1" style={{ color: "#fff" }}>Hello, {user?.name || 'User'}! </h2>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>Ready for your workout today?</p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/exercises/${todayExercise?.id}`)}
            className="relative z-10 self-start mt-4 flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(8px)" }}
          >
            <span>Start workout</span>
            <ArrowRight size={14} />
          </Button>
        </Card>

        <Card className="bg-white border-[var(--border-card)] shadow-sm rounded-2xl p-6 flex flex-col justify-center items-center text-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--coral-surface)] flex items-center justify-center text-[var(--coral-text)]">
            <Calendar size={20} />
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-bold uppercase text-[var(--text-muted)] tracking-wider">
              Today
            </span>
            <h3 className="text-2xl font-black text-[var(--text-main)] mt-0.5">
              {todayDate.split(',')[0]}
            </h3>
            <p className="text-xs font-semibold text-[var(--text-muted)] mt-0.5">
              {todayDate.substring(todayDate.indexOf(',') + 1).trim()}
            </p>
          </div>
        </Card>
        <Card className="bg-white border-[var(--border-card)] shadow-sm rounded-2xl p-6 flex flex-col justify-between text-left">
          <div>
            <span className="text-[11px] font-bold uppercase text-[var(--text-muted)] tracking-wider block mb-2">
              Target Categories ({selectedGoals.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedGoals.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    disabled={isUpdatingGoal}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1"
                    style={{
                      borderColor: isSelected ? 'var(--primary-solid)' : 'var(--border-card)',
                      background: isSelected ? 'var(--accent-surface)' : 'var(--bg-canvas)',
                      color: isSelected ? 'var(--primary-hover)' : 'var(--text-muted)',
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    <span>{cat.label}</span>
                    {isSelected && <span className="text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
      {/* second row */}
      <div className="text-center grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        <Card className="bg-[var(--accent-surface)] p-6">
          <div>
            <div className="w-full h-16 flex items-center justify-center">
              {recentSessions.length > 0 ? <Trophy size={48} style={{
                stroke: "var(--primary-light)"
              }}
              /> : <Trophy size={48} color="#837c7c" fill="#000000"
              />}
            </div>
            <span className="uppercase text-[10px] font-bold tracking-widest text-[var(--text-muted)]">Total</span>
          </div>
          <div className="">
            <span className="text-4xl font-extrabold text-[var(--text-main)]">
              {recentSessions.length}
            </span>
          </div>
          <p className="text-xs font-semibold text-[var(--text-muted)]">Workouts Completed</p>
          <div className="grid grid-cols-7 gap-2 mt-4 pt-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-1 rounded-full bg-[var(--primary-solid)]/40 w-full" />
            ))}
          </div>
        </Card>
        <Card className="bg-[var(--accent-surface)] border-transparent p-6 flex flex-col justify-between">
          <div className="w-full h-16 flex items-center justify-center text-[var(--coral-text)]">
            {recentSessions.length > 0 ? <Flame size={48} color="#ea580c" fill="#f97316"
            /> : <Flame size={48} color="#837c7c" fill="#000000"
            />}
          </div>
          <div className="w-full text-center mt-2">
            <div>
              <span className="text-4xl font-extrabold text-[var(--text-main)]">
                {recentSessions.length > 0 ? '1' : '0'}
              </span>
            </div>
            <p className="text-xs font-bold text-[var(--text-main)]">
              {recentSessions.length > 0 || 1 ? 'Days Streak' : 'Day Streak'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              Start a session to {recentSessions.length > 0 ? 'continue' : 'begin'} your streak!
            </p>
          </div>
        </Card>
        <Card className="bg-[var(--primary-light)]/10 backdrop-blur-md border border-[var(--primary-hover)]/20 rounded-2xl shadow-xl p-6 text-white rounded-2xl p-6 flex flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[var(--primary-solid)]/20 flex items-center justify-center text-[var(--coral-text)] shrink-0 shadow-sm">
              <User size={20} />
            </div>
            <div>
              <h4 className="font-extrabold text-[var(--text-main)] text-base">Complete your profile</h4>
              <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5">Unlock personalized workouts</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => navigate('/profile')} className="w-full text-xs font-bold px-4 py-2 rounded-xl transition-all">
              Setup Your Profile
            </Button>
          </div>
        </Card>
      </div>

      {/* Recommended Exercises (Algorithm 4) */}
      <Card className="bg-white border-[var(--border-card)] shadow-sm rounded-2xl p-6 m-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-extrabold text-[var(--text-main)] tracking-tight">
            <span>Recommended for You</span>
          </h3>
          <Link to="/exercises" className="text-xs font-bold bg-[var(--bg-canvas)] border border-[var(--border-card)] hover:bg-[var(--primary-light)] text-[var(--text-main)] px-3 py-1.5 rounded-lg transition-colors shadow-sm">View All</Link>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {exercises.length > 0 ? (
            exercises.slice(0, 3).map((ex) => (
              <Card key={ex.id} variant="default" className="py-2 hover:border-[var(--primary-hover)] transition-colors cursor-pointer group" onClick={() => navigate(`/exercises/${ex.id}`)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-xl bg-[var(--accent-surface)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Dumbbell className="h-5 w-5 text-[var(--primary-solid)]" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-main)]">
                        {ex.name}
                      </h4>
                      <p className="text-xs font-medium text-[var(--text-muted)] truncate max-w-[200px]">
                        {ex.muscle_group} • {ex.difficulty}
                      </p>
                    </div>
                  </div>
                  <div className="text-[var(--primary-hover)] flex items-center pr-2">
                    <span className="text-xs font-bold mr-2 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">Start</span>
                    <ArrowRight size={18} />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-[var(--accent-surface)] flex items-center justify-center text-[var(--primary-hover)] mb-4">
                <Dumbbell size={24} />
              </div>
              <h4 className="font-bold text-[var(--text-main)] text-base">Profile Setup Required</h4>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1 mb-6 font-medium leading-relaxed">Update your goal and age in your profile to load personalized exercises.</p>
              <Button
                onClick={() => navigate('/profile')} className="bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold h-11 px-6 rounded-full transition-all flex items-center gap-2">
                <span>Go to Profile</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          )}
        </div>
      </Card>
    </PageTransition>
  );
}
