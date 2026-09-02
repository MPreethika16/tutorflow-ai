import React from "react";

export default function StudentDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-9 w-48 bg-secondary/50 animate-pulse rounded-md"></div>

      <div className="flex space-x-2 border-b border-border pb-1">
        <div className="h-10 w-28 bg-secondary/30 animate-pulse rounded-t-lg"></div>
        <div className="h-10 w-28 bg-secondary/20 animate-pulse rounded-t-lg"></div>
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-surface border border-border rounded-xl p-6 flex flex-col sm:flex-row justify-between gap-4 h-32 animate-pulse">
            <div className="space-y-3 flex-1">
              <div className="h-4 w-24 bg-secondary/40 rounded"></div>
              <div className="h-6 w-3/4 sm:w-1/2 bg-secondary/60 rounded"></div>
              <div className="h-4 w-48 bg-secondary/30 rounded mt-4"></div>
            </div>
            <div className="w-full sm:w-40 h-10 bg-secondary/40 rounded mt-auto sm:mt-0"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
