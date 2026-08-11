import { useState, useEffect } from "react";
import { LogOut, Settings, User as UserIcon, Bell, Shield, HelpCircle, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { BiometricProfile } from "@/services/biometricService";
import { biometricService } from "@/lib/api";

const PROFILE_SECTIONS = [
  { id: "personal", icon: UserIcon, label: "Personal Information" },
  { id: "physiological", icon: Activity, label: "Physiological Profile" },
  { id: "privacy", icon: Shield, label: "Privacy & Security" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "settings", icon: Settings, label: "App Settings" },
  { id: "help", icon: HelpCircle, label: "Help & Support" },
];

export function ProfilePage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<BiometricProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const data = await biometricService.getProfile();
      setProfile(data);
      setIsLoading(false);
    };
    fetchProfile();
  }, []);

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  const renderSectionContent = (id: string) => {
    if (id === "personal") {
      return (
        <div className="pt-4 mt-4 border-t space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Full Name</div>
              <div className="font-medium text-sm">{user?.name || "Not specified"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Email Address</div>
              <div className="font-medium text-sm">{user?.email || "Not specified"}</div>
            </div>
          </div>
        </div>
      );
    }

    if (id === "physiological") {
      if (isLoading) return <div className="pt-4 mt-4 text-center text-xs text-muted-foreground">Loading profile...</div>;
      if (!profile) return <div className="pt-4 mt-4 text-center text-xs text-muted-foreground">No physiological data found.</div>;

      return (
        <div className="pt-4 mt-4 border-t space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Age Group</div>
              <div className="font-medium">{profile.age_group || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Biological Sex</div>
              <div className="font-medium capitalize">{profile.sex || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Height</div>
              <div className="font-medium">
                {profile.height ? (() => {
                  const totalInches = Math.round(parseFloat(String(profile.height)) / 2.54);
                  const ft = Math.floor(totalInches / 12);
                  const inc = totalInches % 12;
                  return `${ft}' ${inc}" (${profile.height} cm)`;
                })() : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Weight</div>
              <div className="font-medium">{profile.weight ? `${profile.weight} kg` : "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">BMI</div>
              <div className="font-medium">{profile.bmi || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Goals</div>
              <div className="font-medium capitalize">{profile.goal ? profile.goal.split(',').map(g => g.trim().replace(/[-_]/g, ' ')).join(', ') : "-"}</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="pt-4 mt-4 border-t text-sm text-muted-foreground italic text-center animate-in fade-in slide-in-from-top-2">
        This section is under construction.
      </div>
    );
  };

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6 relative z-10">
      <Header title="Profile" />

      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col items-center text-center pb-6 border-b">
          <div className="h-24 w-24 rounded-full bg-[var(--primary-solid)]/10 flex items-center justify-center text-primary mb-4 border-2 border-primary/20 shadow-xl">
            <span className="text-3xl font-black">{user?.name?.charAt(0) || 'U'}</span>
          </div>
          <h2 className="text-2xl font-black">{user?.name || 'User'}</h2>
          <p className="text-muted-foreground font-medium">{user?.email}</p>
        </div>

        <div className="grid gap-4 w-full max-w-2xl mx-auto">
          {PROFILE_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSection === section.id;
            return (
              <Card
                key={section.id}
                className={`border-none shadow-sm transition-all duration-300 ${isExpanded ? 'bg-white dark:bg-neutral-900 border border-primary/20 shadow-md' : 'bg-transparent hover:bg-white/50 dark:hover:bg-neutral-900/50'}`}
              >
                <CardContent className="p-4 flex flex-col cursor-pointer" onClick={() => toggleSection(section.id)}>
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-[var(--primary-solid)] text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-foreground'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 font-bold text-base">{section.label}</div>
                    <div className="text-muted-foreground transition-transform duration-300">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                  {isExpanded && renderSectionContent(section.id)}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="pt-6 border-t font-semibold flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
          <Button
            variant="outline"
            className="w-full sm:w-auto font-black"
            onClick={async () => {
              if (window.confirm("Are you sure you want to delete your current biomechanical profile and start over?")) {
                try {
                  await biometricService.deleteProfile();
                  // Wait for delete, then reset local auth state and navigate to welcome which will redirect to setup
                  const authStore = (await import("@/store/authStore")).useAuthStore.getState();
                  if (authStore.user) {
                    authStore.setUser({ ...authStore.user, onboarding_complete: false });
                  }
                  window.location.href = "/onboarding/physiological-profile";
                } catch (e) {
                  console.error(e);
                }
              }
            }}
          >
            <Activity className="h-5 w-5 mr-3 text-[var(--primary-solid)]" />
            Start Over Setup
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full mb-12 sm:w-auto sm:mb-0 font-black"
            onClick={logout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
