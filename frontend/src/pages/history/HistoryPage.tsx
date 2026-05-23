import { Calendar, Activity } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageTransition } from "@/components/common/PageTransition";

export function HistoryPage() {
  return (
    <PageTransition variant="fade" className="flex flex-col min-h-screen pb-20 md:pb-6">
      <Header title="Workout History" />
      
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex gap-4 mb-6">
          <Card className="flex-1 bg-primary text-primary-foreground border-none">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">12</div>
              <div className="text-xs opacity-80">Workouts</div>
            </CardContent>
          </Card>
          <Card className="flex-1">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">420</div>
              <div className="text-xs text-muted-foreground">Active Mins</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {[
            { date: "Today", title: "Upper Body Strength", duration: "45 mins", type: "Strength" },
            { date: "Yesterday", title: "Cardio Intervals", duration: "30 mins", type: "Cardio" },
            { date: "Oct 24", title: "Core & Stability", duration: "25 mins", type: "Core" },
            { date: "Oct 22", title: "Full Body Mobility", duration: "40 mins", type: "Mobility" },
          ].map((item, i) => (
            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <Activity className="h-4 w-4" />
              </div>
              <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-sm">{item.title}</h4>
                    <span className="text-xs text-muted-foreground">{item.date}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]"><Calendar className="h-3 w-3 mr-1" /> {item.duration}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{item.type}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
