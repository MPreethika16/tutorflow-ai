import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";

export default function Loading() {
  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-pulse">
      {/* Skeleton Header */}
      <div className="space-y-4">
        <div className="h-4 w-48 bg-secondary/50 rounded"></div>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 gap-4">
          <div className="w-full">
            <div className="h-8 w-64 bg-secondary/50 rounded mb-3"></div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-24 bg-secondary/50 rounded-full"></div>
              <div className="h-4 w-32 bg-secondary/50 rounded"></div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="h-4 w-24 bg-secondary/50 rounded mb-2"></div>
            <div className="h-5 w-40 bg-secondary/50 rounded"></div>
          </div>
        </header>
      </div>

      {/* Skeleton Question Navigator */}
      <div className="border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-16 bg-secondary/50 rounded mr-2"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-8 rounded-full bg-secondary/50"></div>
          ))}
        </div>
      </div>

      {/* Skeleton Review Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
        {/* Left Column Skeleton */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <div className="h-6 w-3/4 bg-secondary/50 rounded mb-3"></div>
            <div className="h-4 w-32 bg-secondary/50 rounded"></div>
          </div>

          <div className="h-10 w-full bg-secondary/50 rounded-lg"></div>

          <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
            <div className="h-4 w-32 bg-secondary/50 rounded"></div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-secondary/50 rounded"></div>
              <div className="h-4 w-full bg-secondary/50 rounded"></div>
              <div className="h-4 w-2/3 bg-secondary/50 rounded"></div>
            </div>
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="lg:col-span-5 space-y-4">
          <div className="h-24 w-full bg-secondary/50 rounded-lg"></div>
          <Card className="bg-surface border-border shadow-none">
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between">
                <div className="h-5 w-32 bg-secondary/50 rounded"></div>
              </div>
              <div className="h-12 w-32 bg-secondary/50 rounded-md"></div>
              <div className="h-24 w-full bg-secondary/50 rounded-md"></div>
              <div className="h-10 w-full bg-secondary/50 rounded-md"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
