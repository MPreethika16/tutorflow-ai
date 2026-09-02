import React from "react";

export default function ResultLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="h-4 w-48 bg-secondary/30 animate-pulse rounded"></div>

      <header className="space-y-3">
        <div className="h-10 w-3/4 bg-secondary/50 animate-pulse rounded-md"></div>
        <div className="h-5 w-1/3 bg-secondary/30 animate-pulse rounded-md"></div>
      </header>

      {/* Result Summary Skeleton */}
      <div className="bg-surface border border-border rounded-xl p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-8 h-48 animate-pulse">
        <div className="space-y-4 flex-1">
          <div className="h-4 w-32 bg-secondary/40 rounded"></div>
          <div className="flex items-end gap-4">
            <div className="h-16 w-24 bg-secondary/60 rounded"></div>
            <div className="h-6 w-32 bg-secondary/40 rounded mb-2"></div>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full md:w-48 border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8">
          <div className="h-4 w-full bg-secondary/40 rounded"></div>
          <div className="h-4 w-3/4 bg-secondary/30 rounded"></div>
        </div>
      </div>

      <section className="space-y-6">
        {/* Question Skeletons */}
        {[1, 2].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-6 sm:p-8 space-y-6 animate-pulse">
            <div className="flex justify-between gap-4 border-b border-border pb-4">
              <div className="space-y-3 flex-1">
                <div className="h-4 w-24 bg-secondary/40 rounded"></div>
                <div className="h-6 w-full bg-secondary/50 rounded"></div>
                <div className="h-6 w-3/4 bg-secondary/50 rounded"></div>
              </div>
              <div className="w-24 h-8 bg-secondary/30 rounded"></div>
            </div>
            <div className="space-y-3">
              <div className="h-3 w-20 bg-secondary/40 rounded"></div>
              <div className="h-16 w-full bg-secondary/30 rounded"></div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
