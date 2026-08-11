import * as React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "warning" | "outline";
}

export function Badge({ className = "", variant = "default", ...props }: BadgeProps) {
  const baseStyles =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";
  
  const variants = {
    default: "border-transparent bg-primary text-white",
    secondary: "border-transparent bg-secondary text-foreground",
    warning: "border-transparent bg-warning text-white",
    outline: "border-border text-foreground",
  };

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`} {...props} />
  );
}
