import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  className?: string;
  variant?: "fade" | "slide" | "scale";
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
  },
  scale: {
    initial: { scale: 0.96, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.96, opacity: 0 },
  },
};

export function PageTransition({ 
  children, 
  className,
  variant = "slide",
  ...props 
}: PageTransitionProps) {
  return (
    <motion.div
      initial={variants[variant].initial}
      animate={variants[variant].animate}
      exit={variants[variant].exit}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
