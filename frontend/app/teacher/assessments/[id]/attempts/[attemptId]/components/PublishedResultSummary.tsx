import React from 'react';
import { Card, CardContent } from "@/components/ui/Card";

interface PublishedResultSummaryProps {
  finalMarks: number;
  maximumMarks: number;
  publishedAt: string;
}

export function PublishedResultSummary({ finalMarks, maximumMarks, publishedAt }: PublishedResultSummaryProps) {
  // Safe percentage calculation with zero-denominator guard
  const percentage = maximumMarks > 0
    ? Math.round((finalMarks / maximumMarks) * 100)
    : 0;

  return (
    <Card className="bg-success/5 border-success/30 shadow-sm mt-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="font-semibold text-foreground text-base tracking-tight">Result Published</h3>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-secondary-foreground font-medium mb-1">Final Score</p>
            <p className="text-2xl font-bold text-foreground">
              {finalMarks} <span className="text-base font-normal text-secondary-foreground">/ {maximumMarks}</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-secondary-foreground font-medium mb-1">Percentage</p>
            <p className="text-2xl font-bold text-foreground">{percentage}%</p>
          </div>
          <div>
            <p className="text-sm text-secondary-foreground font-medium mb-1">Published On</p>
            <p className="text-base text-foreground font-medium mt-1">
              {new Date(publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
