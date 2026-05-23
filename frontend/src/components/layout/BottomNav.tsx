import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAVIGATION_ITEMS } from "@/constants/navigation";

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 z-40 w-full border-t bg-background pb-safe-area shadow-[0_-4px_16px_rgba(0,0,0,0.04)] md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {NAVIGATION_ITEMS.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center space-y-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
