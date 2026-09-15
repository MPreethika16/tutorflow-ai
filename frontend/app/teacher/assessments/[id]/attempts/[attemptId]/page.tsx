import * as React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/auth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReviewWorkspace } from "./components/ReviewWorkspace";
import { PublishedResultSummary } from "./components/PublishedResultSummary";
import { SinglePublishAction } from "../../components/SinglePublishAction";

// Helper to fetch data with auth headers
async function fetchWithAuth(endpoint: string) {
  try {
    const res = await authenticatedFetch(endpoint);

    if (res.status === 404 || res.status === 403) {
      return { error: 'NOT_FOUND', status: res.status };
    }

    if (!res.ok) {
      return { error: 'API_ERROR', status: res.status };
    }

    const data = await res.json();
    return { data };
  } catch {
    return { error: 'API_ERROR', status: 500 };
  }
}

export default async function TeacherAttemptReviewPage({ params }: { params: { id: string, attemptId: string } }) {
  const { id, attemptId } = await params;

  // 1. Fetch the attempt data
  // GET /assessments/:assessmentId/attempts/:attemptId/review
  const reviewRes = await fetchWithAuth(`/assessments/${id}/attempts/${attemptId}/review`);

  if (reviewRes.error === 'NOT_FOUND') {
    notFound();
  }

  if (reviewRes.error === 'API_ERROR' || !reviewRes.data) {
    return (
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex flex-col items-center justify-center p-12 bg-surface border border-destructive/20 rounded-lg shadow-sm text-center space-y-4">
          <p className="text-foreground font-medium">Unable to load review data.</p>
          <p className="text-secondary-foreground text-sm">Please try again later or contact support if the issue persists.</p>
        </div>
      </main>
    );
  }

  const { attempt, answers, summary } = reviewRes.data;

  // Derive "Ready to publish" state entirely from backend fields
  // Do NOT add publication controls here (Phase 23)
  const isReadyToPublish = attempt.status === 'SUBMITTED' && summary.reviewComplete;

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* Review Header */}
      <div className="space-y-4">
        <nav className="text-sm font-medium text-secondary-foreground">
          <Link href="/teacher/assessments" className="hover:text-primary transition-colors">Assessments</Link>
          <span className="mx-2 opacity-50">/</span>
          <Link href={`/teacher/assessments/${id}`} className="hover:text-primary transition-colors">Assessment Detail</Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-foreground">Review Attempt</span>
        </nav>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 gap-4">
          <div>
            <h1 className="text-2xl font-heading text-primary tracking-tight">Attempt Review</h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={attempt.status} />
              <span className="text-sm text-secondary-foreground">
                Submitted on {new Date(attempt.submittedAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="text-sm font-medium text-secondary-foreground mb-1">
              Review Progress
            </div>
            {attempt.status === 'PUBLISHED' ? (
              <span className="inline-flex items-center gap-1.5 text-success font-semibold text-sm bg-success/10 px-3 py-1 rounded-full border border-success/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                Published
              </span>
            ) : isReadyToPublish ? (
              <SinglePublishAction assessmentId={id} attemptId={attemptId} />
            ) : (
              <span className="text-sm font-medium text-foreground">
                {summary.approvedAnswers} of {summary.totalAnswers} reviewed
              </span>
            )}
            <p className="text-xs text-secondary-foreground/70 max-w-xs text-right mt-1.5">
              Unanswered questions are omitted and will score zero.
            </p>
          </div>
        </header>
      </div>

      {/* Published Result Summary */}
      {attempt.status === 'PUBLISHED' && attempt.publishedAt && (
        <PublishedResultSummary
          finalMarks={attempt.finalMarks}
          maximumMarks={attempt.maximumMarks}
          publishedAt={attempt.publishedAt}
        />
      )}

      {/* Review Workspace (Client Component) */}
      <ReviewWorkspace
        attempt={attempt}
        answers={answers}
        summary={summary}
        assessmentId={id}
      />
    </main>
  );
}
