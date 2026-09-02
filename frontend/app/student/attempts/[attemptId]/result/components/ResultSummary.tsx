import React from "react";
import { Card, CardContent } from "@/components/ui/Card";

interface ResultSummaryProps {
  finalMarks: number;
  maximumMarks: number;
  publishedAt: string;
  submittedAt?: string;
}

export function ResultSummary({ finalMarks, maximumMarks, publishedAt, submittedAt }: ResultSummaryProps) {
  const hasValidMaxMarks = maximumMarks > 0;
  const percentage = hasValidMaxMarks ? Math.round((finalMarks / maximumMarks) * 100) : null;

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(new Date(dateString));
  };

  return (
    <Card className="bg-surface shadow-sm border-border overflow-hidden">
      <CardContent className="p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-secondary-foreground mb-4">
            Assessment Result
          </h2>
          <div className="flex items-baseline gap-4">
            <div
              className="text-6xl font-heading font-semibold text-foreground tracking-tight"
              aria-label={percentage !== null ? `Score ${finalMarks} out of ${maximumMarks}, ${percentage} percent` : `Score ${finalMarks} marks`}
            >
              {percentage !== null ? `${percentage}%` : "—"}
            </div>
            <div className="text-xl font-medium text-secondary-foreground">
              {finalMarks} / {maximumMarks} marks
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm text-secondary-foreground md:text-right border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8">
          <div className="flex justify-between md:justify-end gap-8">
            <span className="font-medium">Published</span>
            <span>{formatDate(publishedAt)}</span>
          </div>
          {submittedAt && (
            <div className="flex justify-between md:justify-end gap-8 opacity-80">
              <span className="font-medium">Submitted</span>
              <span>{formatDate(submittedAt)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
