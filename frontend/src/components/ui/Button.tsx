import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary-solid)] text-white hover:bg-[var(--primary-hover)] shadow-button hover:shadow-button-hover",
        secondary: "bg-[var(--accent-surface)] text-[var(--accent-text)] hover:bg-[var(--accent-surface)]/80",
        outline: "border border-[var(--border-card)] bg-[var(--bg-card)] text-[var(--text-main)] hover:bg-[var(--accent-surface)] hover:text-[var(--accent-text)]",
        ghost: "text-[var(--text-muted)] hover:bg-[var(--accent-surface)] hover:text-[var(--text-main)]",
        link: "text-[var(--accent-text)] underline-offset-4 hover:underline",
        destructive: "bg-[var(--coral-text)] text-white hover:bg-[var(--coral-text)]/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  // Omit ref to properly support motion.button and regular button
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "ref">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// Intersect with HTMLMotionProps, omitting conflicts
type MotionButtonProps = Omit<HTMLMotionProps<"button">, keyof ButtonProps> & ButtonProps;

const Button = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    { className, variant, size, fullWidth, asChild = false, isLoading, leftIcon, rightIcon, children, disabled, ...props },
    ref
  ) => {
    const Comp = (asChild ? Slot : motion.create("button")) as any;
    
    // Default motion props if not provided
    const motionProps = asChild 
      ? {} 
      : {
          whileTap: { scale: disabled || isLoading ? 1 : 0.96 },
        };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...motionProps}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
