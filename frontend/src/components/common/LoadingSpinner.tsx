import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

export function LoadingSpinner({ 
  className, 
  size = "md", 
  label = "Loading...", 
  fullScreen = false 
}: LoadingSpinnerProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center space-y-3 text-primary", className)}>
      <Loader2 className={cn("animate-spin", sizeClasses[size])} aria-hidden="true" />
      {label && <span className="sr-only" aria-busy="true">{label}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}
