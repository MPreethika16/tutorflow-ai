"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { TeacherOverrideForm } from "./TeacherOverrideForm";

export interface ReviewQuestion {
  prompt: string;
  marks: number;
  type: string;
  modelAnswer?: string | null;
  gradingInstructions?: string | null;
  options?: Array<{ id: string; text: string }> | null;
  correctOption?: string | null;
}

export interface ReviewEvaluation {
  status: "PENDING" | "EVALUATING" | "WAITING_FOR_REVIEW" | "APPROVED" | "FAILED" | string;
  aiMarks?: number | null;
  aiFeedback?: string | null;
  aiConfidence?: number | null;
  teacherMarks?: number | null;
  teacherFeedback?: string | null;
  reviewCompletedAt?: string | null;
  failureReason?: string | null;
}

export interface ReviewAnswer {
  id: string;
  selectedOption?: string | null;
  textAnswer?: string | null;
  voiceUrl?: string | null;
  question: ReviewQuestion;
  evaluation?: ReviewEvaluation | null;
}

export interface ReviewAttemptSummary {
  totalQuestions?: number;
  gradedCount?: number;
  needsReviewCount?: number;
  failedCount?: number;
  reviewComplete?: boolean;
}

export interface ReviewAttemptData {
  attemptId: string;
  studentName?: string;
  submittedAt?: string | null;
  status?: string;
}

export interface ReviewWorkspaceProps {
  attempt: ReviewAttemptData;
  answers: ReviewAnswer[];
  summary?: ReviewAttemptSummary;
  assessmentId: string;
}

export function ReviewWorkspace({ attempt, answers, assessmentId }: ReviewWorkspaceProps) {
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(answers[0]?.id || null);

  // Intersection Observer for active question highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveQuestionId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px" }
    );

    answers.forEach((ans) => {
      const el = document.getElementById(ans.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [answers]);

  return (
    <div className="space-y-8">
      {/* Question Navigator (Sticky) */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-4 border-b border-border shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <span className="text-sm font-medium text-secondary-foreground mr-2">Questions:</span>
          {answers.map((ans, index) => {
            const isApproved = ans.evaluation?.status === "APPROVED";
            const isFailed = ans.evaluation?.status === "FAILED";
            const isNeedsReview = ans.evaluation?.status === "WAITING_FOR_REVIEW";
            const isActive = activeQuestionId === ans.id;

            let colorClass = "bg-surface text-secondary-foreground border-border";
            if (isApproved) colorClass = "bg-success/10 text-success border-success/30";
            else if (isFailed) colorClass = "bg-destructive/10 text-destructive border-destructive/30";
            else if (isNeedsReview) colorClass = "bg-warning/10 text-warning-foreground border-warning/30";

            return (
              <a
                key={ans.id}
                href={`#${ans.id}`}
                aria-label={`Question ${index + 1}: ${isApproved ? 'Approved' : isFailed ? 'Needs attention' : isNeedsReview ? 'Needs review' : 'Grading'}`}
                className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border text-xs font-semibold transition-all ${colorClass} ${isActive ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:opacity-80'}`}
              >
                {index + 1}
              </a>
            );
          })}
        </div>
      </div>

      {/* Answer List */}
      <div className="space-y-16">
        {answers.map((ans, index) => (
          <QuestionReviewCard key={ans.id} index={index + 1} answer={ans} assessmentId={assessmentId} attemptId={attempt.attemptId} />
        ))}
      </div>
    </div>
  );
}

function QuestionReviewCard({ index, answer, assessmentId, attemptId }: { index: number, answer: ReviewAnswer, assessmentId: string, attemptId: string }) {
  const { question, evaluation } = answer;
  const isApproved = evaluation?.status === "APPROVED";
  const isFailed = evaluation?.status === "FAILED";
  const isPending = evaluation?.status === "PENDING" || evaluation?.status === "EVALUATING";
  const isWaiting = evaluation?.status === "WAITING_FOR_REVIEW";

  return (
    <div id={answer.id} className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

      {/* LEFT COLUMN: Student Context */}
      <div className="lg:col-span-7 space-y-6">
        {/* Question Prompt */}
        <div>
          <h2 className="text-lg font-medium text-foreground mb-2">
            <span className="text-secondary-foreground mr-2">{index}.</span>
            {question.prompt}
          </h2>
          <p className="text-sm font-medium text-secondary-foreground uppercase tracking-wider">
            {question.marks} Marks • {question.type}
          </p>
        </div>

        {/* Model Answer (Progressive Disclosure) */}
        {question.modelAnswer && (
          <details className="group border border-border rounded-lg bg-surface">
            <summary className="px-4 py-3 cursor-pointer font-medium text-sm text-secondary-foreground select-none hover:text-foreground transition-colors">
              View Model Answer
            </summary>
            <div className="px-4 pb-4 pt-1 text-sm text-foreground border-t border-border mt-1">
              {question.modelAnswer}
            </div>
          </details>
        )}

        {/* Student Answer */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-5">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Student Answer</p>
          <div className="text-foreground whitespace-pre-wrap">
            {answer.textAnswer || answer.selectedOption || (
              <span className="italic text-secondary-foreground">No text response</span>
            )}
          </div>
          {answer.voiceUrl && (
            <div className="mt-4">
              <audio controls src={answer.voiceUrl} className="w-full h-10" />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Teacher Decision (Sticky) */}
      <div className="lg:col-span-5 lg:sticky lg:top-32 space-y-4">

        {/* Rubric Reference */}
        {question.gradingInstructions && (
          <div className="border border-border rounded-lg p-4 bg-surface/50 text-sm">
            <h4 className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wider">Grading Rubric</h4>
            <div className="text-secondary-foreground whitespace-pre-wrap">{question.gradingInstructions}</div>
          </div>
        )}

        {/* Evaluation State Switcher */}
        {isPending && (
          <Card className="bg-surface border-border shadow-sm">
            <CardContent className="p-6 text-center text-secondary-foreground">
              <div className="animate-pulse h-4 w-1/2 bg-secondary/30 mx-auto rounded mb-2" />
              <p className="text-sm font-medium">Grading in progress...</p>
            </CardContent>
          </Card>
        )}

        {isFailed && (
          <Card className="bg-destructive/5 border-destructive/20 shadow-sm">
            <CardContent className="p-6">
              <p className="text-destructive font-medium text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                AI grading could not be completed.
              </p>
            </CardContent>
          </Card>
        )}

        {(isWaiting || isApproved) && (
          <div className="space-y-4">

            {/* AI Suggestion (Neutral) */}
            {(evaluation.aiMarks !== null || evaluation.aiFeedback !== null) && (
              <div className="border border-dashed border-border rounded-lg p-4 bg-surface text-sm">
                <h4 className="font-semibold text-secondary-foreground mb-3 text-xs uppercase tracking-wider flex justify-between items-center">
                  <span>AI Suggestion</span>
                  {evaluation.aiMarks !== null && (
                    <span className="bg-secondary/50 px-2 py-0.5 rounded text-foreground font-medium">{evaluation.aiMarks} / {question.marks}</span>
                  )}
                </h4>
                {evaluation.aiFeedback && (
                  <div className="text-foreground whitespace-pre-wrap">{evaluation.aiFeedback}</div>
                )}
              </div>
            )}

            {/* Teacher Decision Form (Actionable or Read-Only) */}
            <Card className={`shadow-sm border transition-colors ${isApproved ? 'border-success/30 bg-success/5' : 'border-primary/30 bg-surface'}`}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">
                    {isApproved ? 'Approved Grade' : 'Teacher Decision'}
                  </h3>
                  {isApproved && (
                    <span className="text-success text-xs font-bold uppercase flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      Approved
                    </span>
                  )}
                </div>

                {isApproved ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-secondary-foreground block">Marks Awarded</label>
                      <div className="text-lg font-semibold text-foreground">{evaluation.teacherMarks ?? evaluation.aiMarks} <span className="text-secondary-foreground text-sm font-normal">/ {question.marks}</span></div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-secondary-foreground block">Feedback</label>
                      <div className="text-sm text-foreground whitespace-pre-wrap">
                        {evaluation.teacherFeedback || evaluation.aiFeedback || <span className="italic text-secondary-foreground">No feedback provided.</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <TeacherOverrideForm
                    assessmentId={assessmentId}
                    attemptId={attemptId}
                    answerId={answer.id}
                    maximumMarks={question.marks}
                    initialMarks={evaluation.teacherMarks ?? evaluation.aiMarks ?? null}
                    initialFeedback={evaluation.teacherFeedback ?? evaluation.aiFeedback ?? null}
                  />
                )}
              </CardContent>
            </Card>

          </div>
        )}

      </div>
    </div>
  );
}
