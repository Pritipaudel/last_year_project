import { Link, useLocation } from "react-router-dom";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAVIGATION_ITEMS } from "@/constants/navigation";

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden w-64 flex-col border-r bg-background md:flex h-screen fixed top-0 left-0">
      <div className="flex h-16 items-center border-b px-6">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-primary text-xl">
          <Activity className="h-6 w-6" />
          <span>AECS</span>
        </Link>
      </div>
      
      <nav className="flex-1 space-y-1 px-4 py-6 overflow-y-auto">
        {NAVIGATION_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="bg-muted rounded-xl p-4 text-sm text-center">
          <p className="font-medium text-foreground mb-1">Need help?</p>
          <p className="text-muted-foreground text-xs mb-3">Contact your support team or doctor.</p>
          <Link to="/doctors" className="text-primary text-sm font-medium hover:underline">
            Find Doctor
          </Link>
        </div>
      </div>
    </aside>
  );
}
