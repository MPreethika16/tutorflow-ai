"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { startAssessmentAction } from "../actions";

interface AvailableAssessmentCardProps {
  assessment: {
    assessmentId: string;
    title: string;
    subject: string;
    board: string | null;
    grade: string | null;
    durationMinutes: number;
    maximumMarks: number;
    attemptStatus: "AVAILABLE" | "IN_PROGRESS";
    attemptId: string | null;
  };
}

export function AvailableAssessmentCard({ assessment }: AvailableAssessmentCardProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAction = async () => {
    if (assessment.attemptStatus === "IN_PROGRESS" && assessment.attemptId) {
      // Just navigate to the active attempt
      router.push(`/student/attempts/${assessment.attemptId}`);
      return;
    }

    // Otherwise, start the assessment
    setIsStarting(true);
    setErrorMsg(null);
    try {
      const data = await startAssessmentAction(assessment.assessmentId);
      // Navigate to the newly created attempt
      if (data.attemptId) {
        router.push(`/student/attempts/${data.attemptId}`);
      }
    } catch (err) {
      setErrorMsg("Failed to start assessment. Please try again.");
      setIsStarting(false);
    }
  };

  const isContinue = assessment.attemptStatus === "IN_PROGRESS";

  return (
    <Card className="bg-surface hover:shadow-md transition-shadow duration-200 border-border group overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {assessment.subject}
              </span>
              {(assessment.board || assessment.grade) && (
                <>
                  <span className="text-secondary-foreground opacity-40">•</span>
                  <span className="text-xs font-medium text-secondary-foreground">
                    {[assessment.board, assessment.grade].filter(Boolean).join(" ")}
                  </span>
                </>
              )}
            </div>

            <h3 className="text-xl font-heading font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {assessment.title}
            </h3>

            <div className="flex items-center gap-4 mt-3 text-sm text-secondary-foreground">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{assessment.durationMinutes} mins</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{assessment.maximumMarks} marks</span>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0 relative">
            <Button
              onClick={handleAction}
              disabled={isStarting}
              variant={isContinue ? "secondary" : "primary"}
              className="w-full sm:w-auto min-w-[160px]"
            >
              {isStarting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Starting...
                </>
              ) : isContinue ? (
                "Continue assessment"
              ) : (
                "Start assessment"
              )}
            </Button>
            {errorMsg && (
              <div className="absolute top-full mt-2 right-0 w-full text-center sm:text-right text-xs text-destructive font-medium">
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
