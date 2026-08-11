import * as React from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className = "" }: PageHeaderProps) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border ${className}`}>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-heading font-semibold text-foreground tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-base text-foreground/70">{description}</p>
        )}
      </div>
      {action && (
        <div className="mt-4 md:mt-0 flex shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
