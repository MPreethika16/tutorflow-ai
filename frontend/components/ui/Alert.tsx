import * as React from "react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "warning";
}

export function Alert({ className = "", variant = "default", children, ...props }: AlertProps) {
  const baseStyles = "relative w-full rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7";
  
  const variants = {
    default: "bg-surface text-foreground border-border",
    warning: "bg-warning/10 text-warning border-warning/20 [&>svg]:text-warning",
  };

  return (
    <div
      role="alert"
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertTitle({ className = "", ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={`mb-1 font-medium leading-none tracking-tight font-heading ${className}`}
      {...props}
    />
  );
}

export function AlertDescription({ className = "", ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={`text-sm [&_p]:leading-relaxed ${className}`}
      {...props}
    />
  );
}
