"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface AttemptHistoryCardProps {
  attempt: {
    assessmentId: string;
    attemptId: string;
    title: string;
    subject: string;
    assessmentKind: string;
    studentStatus: "IN_PROGRESS" | "BEING_GRADED" | "RESULT_READY";
    startedAt: string;
    submittedAt: string | null;
    publishedAt: string | null;
    finalMarks: number | null;
    maximumMarks: number | null;
    percentage: number | null;
  };
}

export function AttemptHistoryCard({ attempt }: AttemptHistoryCardProps) {
  // Privacy defense-in-depth: Force hide if not fully ready
  const isResultReady = attempt.studentStatus === "RESULT_READY" && attempt.publishedAt !== null;

  const finalMarks = isResultReady ? attempt.finalMarks : null;
  const maximumMarks = isResultReady ? attempt.maximumMarks : null;
  const percentage = isResultReady ? attempt.percentage : null;

  // Format dates
  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateStr));
  };

  const displayDate = attempt.submittedAt
    ? `Submitted: ${formatDate(attempt.submittedAt)}`
    : `Started: ${formatDate(attempt.startedAt)}`;

  // Status mapping
  let statusBadge = null;
  if (attempt.studentStatus === "IN_PROGRESS") {
    statusBadge = (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        In progress
      </span>
    );
  } else if (attempt.studentStatus === "BEING_GRADED") {
    statusBadge = (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        Being graded
      </span>
    );
  } else if (attempt.studentStatus === "RESULT_READY") {
    statusBadge = (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Result ready
      </span>
    );
  }

  return (
    <Card className="bg-surface hover:shadow-md transition-shadow duration-200 border-border group overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {attempt.subject}
              </span>
              {statusBadge}
            </div>

            <h3 className="text-xl font-heading font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {attempt.title}
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-3 text-sm text-secondary-foreground">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{displayDate}</span>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0 flex items-center justify-between sm:justify-end gap-6">
            {isResultReady && percentage !== null && (
              <div className="text-right">
                <div
                  className="text-2xl font-heading font-bold text-foreground"
                  aria-label={`Score: ${percentage} percent`}
                >
                  {percentage}%
                </div>
                <div className="text-xs text-secondary-foreground font-medium">
                  {finalMarks} / {maximumMarks} marks
                </div>
              </div>
            )}

            <div>
              {attempt.studentStatus === "IN_PROGRESS" && (
                <Link href={`/student/attempts/${attempt.attemptId}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-auto">
                  Continue assessment
                </Link>
              )}
              {attempt.studentStatus === "RESULT_READY" && (
                <Link href={`/student/attempts/${attempt.attemptId}/result`} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full sm:w-auto">
                  View result
                </Link>
              )}
              {/* BEING_GRADED has no action button, it just waits */}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
