import { LogOut, Settings, User as UserIcon, Bell, Shield, HelpCircle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { useAuth } from "@/hooks/useAuth";

const PROFILE_SECTIONS = [
  { icon: UserIcon, label: "Personal Information" },
  { icon: Activity, label: "Physiological Profile" },
  { icon: Shield, label: "Privacy & Security" },
  { icon: Bell, label: "Notifications" },
  { icon: Settings, label: "App Settings" },
  { icon: HelpCircle, label: "Help & Support" },
];

// Need to import Activity since it's used in the array
import { Activity } from "lucide-react";

export function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title="Profile" />
      
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col items-center text-center pb-6 border-b">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 border-2 border-primary/20">
            <span className="text-3xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
          </div>
          <h2 className="text-2xl font-bold">{user?.name || 'User'}</h2>
          <p className="text-muted-foreground">{user?.email}</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-full">
            Edit Profile
          </Button>
        </div>

        <div className="grid gap-4 w-full max-w-2xl mx-auto">
          {PROFILE_SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            return (
              <Card key={idx} variant="interactive" className="border-none shadow-none bg-transparent hover:bg-muted/50 rounded-lg">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 font-medium">{section.label}</div>
                  <div className="text-muted-foreground">›</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="pt-6 border-t font-semibold text-center mt-8">
          <Button 
            variant="ghost" 
            className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full mb-12 sm:w-auto"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
