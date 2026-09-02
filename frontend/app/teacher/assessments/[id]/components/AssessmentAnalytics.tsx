"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/Card";

interface AnalyticsSummary {
  totalAttempts: number;
  submittedAttempts: number;
  publishedResults: number;
  averageMarks: number | null;
  averagePercentage: number | null;
  highestMarks: number | null;
  lowestMarks: number | null;
}

interface QuestionAnalytics {
  questionId: string;
  prompt: string;
  maximumMarks: number;
  numberAnswered: number;
  numberUnanswered: number;
  averageMarks: number | null;
  averagePercentage: number | null;
}

interface AssessmentAnalyticsProps {
  assessmentId: string;
  analytics: {
    assessmentId: string;
    summary: AnalyticsSummary;
    questions: QuestionAnalytics[];
  };
}

function QuestionPerformanceMeter({ question }: { question: QuestionAnalytics }) {
  const hasData = question.averagePercentage !== null;
  const pct = question.averagePercentage ?? 0;

  // Revised color logic per user feedback:
  // - primary/forest tone for strong performance (>75)
  // - muted amber for mid-range (50-75)
  // - restrained crimson only for clearly low performance (<50)
  let barColorClass = "bg-primary";
  if (hasData) {
    if (pct < 50) {
      barColorClass = "bg-destructive/80"; // restrained crimson
    } else if (pct <= 75) {
      barColorClass = "bg-amber-500/80"; // muted amber
    }
  }

  return (
    <div className="py-4 border-b border-border last:border-0 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate" title={question.prompt}>
          {question.prompt}
        </p>
        <div className="text-xs text-secondary-foreground mt-1 flex items-center gap-2">
          <span>{question.maximumMarks} marks</span>
          {question.numberUnanswered > 0 && (
            <>
              <span className="opacity-50">•</span>
              <span className="text-warning-foreground font-medium">{question.numberUnanswered} unanswered</span>
            </>
          )}
        </div>
      </div>

      <div className="w-full sm:w-48 flex-shrink-0 flex items-center gap-3">
        {hasData ? (
          <>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-all ${barColorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div
              className="text-sm font-medium text-foreground w-12 text-right"
              aria-label={`Average score ${pct} percent`}
            >
              {pct}%
            </div>
          </>
        ) : (
          <div className="text-sm text-secondary-foreground italic text-right w-full">
            No data yet
          </div>
        )}
      </div>
    </div>
  );
}

export function AssessmentAnalytics({ assessmentId, analytics }: AssessmentAnalyticsProps) {
  const { summary, questions } = analytics;
  const hasPublished = summary.publishedResults > 0;

  if (!hasPublished) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface border border-border rounded-lg shadow-sm text-center">
        <div className="w-12 h-12 bg-secondary/30 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-secondary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-foreground font-medium">No published results yet</p>
        <p className="text-secondary-foreground text-sm mt-1 max-w-sm">
          Publish at least one student attempt to view performance analytics and export results.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* High Level Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-surface shadow-none border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-secondary-foreground uppercase tracking-wider mb-1">Average Score</p>
            <p className="text-2xl font-heading text-foreground">
              {summary.averageMarks !== null ? Number(summary.averageMarks.toFixed(1)) : '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface shadow-none border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-secondary-foreground uppercase tracking-wider mb-1">Average Percentage</p>
            <p className="text-2xl font-heading text-foreground">
              {summary.averagePercentage !== null ? `${summary.averagePercentage}%` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface shadow-none border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-secondary-foreground uppercase tracking-wider mb-1">Highest Score</p>
            <p className="text-2xl font-heading text-foreground">
              {summary.highestMarks ?? '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-surface shadow-none border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-secondary-foreground uppercase tracking-wider mb-1">Lowest Score</p>
            <p className="text-2xl font-heading text-foreground">
              {summary.lowestMarks ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Question Performance List */}
      <Card className="bg-surface shadow-none border-border">
        <div className="px-6 py-4 border-b border-border bg-secondary/10">
          <h3 className="font-semibold text-foreground">Question Performance</h3>
        </div>
        <CardContent className="p-6">
          <div className="flex flex-col">
            {questions.map((q) => (
              <QuestionPerformanceMeter key={q.questionId} question={q} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
