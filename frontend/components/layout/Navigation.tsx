import * as React from "react";
import Link from "next/link";

export function Navigation({ className = "" }: { className?: string }) {
  return (
    <nav className={`w-full border-b border-border bg-surface ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <div className="flex shrink-0 items-center">
              <span className="font-heading font-bold text-xl text-foreground tracking-tight">
                TutorFlow
              </span>
            </div>
            <div className="hidden sm:-my-px sm:ml-8 sm:flex sm:space-x-8">
              <Link
                href="#"
                className="inline-flex items-center border-b-2 border-primary px-1 pt-1 text-sm font-medium text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="#"
                className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-foreground/70 hover:border-border hover:text-foreground"
              >
                Assessments
              </Link>
              <Link
                href="#"
                className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-foreground/70 hover:border-border hover:text-foreground"
              >
                Students
              </Link>
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <button
              type="button"
              className="rounded-full bg-surface p-1 text-foreground/60 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <span className="sr-only">View profile</span>
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
                TF
              </div>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
