"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { approveAnswer } from "../actions";

interface TeacherOverrideFormProps {
  assessmentId: string;
  attemptId: string;
  answerId: string;
  maximumMarks: number;
  initialMarks: number | null;
  initialFeedback: string | null;
}

export function TeacherOverrideForm({
  assessmentId,
  attemptId,
  answerId,
  maximumMarks,
  initialMarks,
  initialFeedback
}: TeacherOverrideFormProps) {
  const defaultMarks = initialMarks ?? 0;
  const defaultFeedback = initialFeedback ?? "";

  const [marks, setMarks] = useState<string>(defaultMarks.toString());
  const [feedback, setFeedback] = useState<string>(defaultFeedback);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Derive dirty state
  const isDirty = marks !== defaultMarks.toString() || feedback !== defaultFeedback;

  const handleSubmit = async () => {
    // Client-side validation
    const parsedMarks = parseFloat(marks);
    if (isNaN(parsedMarks) || parsedMarks < 0 || parsedMarks > maximumMarks) {
      setErrorMsg(`Marks must be between 0 and ${maximumMarks}.`);
      return;
    }

    const trimmedFeedback = feedback.trim();

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await approveAnswer(
        assessmentId,
        attemptId,
        answerId,
        parsedMarks,
        trimmedFeedback === "" ? null : trimmedFeedback
      );

      if (!res.success) {
        if (res.error === 'CONFLICT') {
          setErrorMsg("This answer is no longer available for review. Refreshing the latest state.");
        } else if (res.error === 'VALIDATION') {
          setErrorMsg(`Marks must be between 0 and ${maximumMarks}, and feedback cannot be whitespace only.`);
        } else if (res.error === 'UNAUTHORIZED') {
          setErrorMsg("Your session expired. Please log in again.");
        } else {
          setErrorMsg("We couldn't save this review. Your changes are still here.");
        }
      }
      // On success, Next.js server action revalidates the path, which will automatically
      // replace this component with the read-only Approved version.
    } catch (e) {
      setErrorMsg("We couldn't save this review. Your changes are still here.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3 py-2 rounded-md" role="alert" aria-live="assertive">
          {errorMsg}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor={`marks-${answerId}`} className="text-xs font-medium text-secondary-foreground flex justify-between">
          <span>Marks Awarded</span>
          <span className="text-[10px] uppercase">{isDirty && "Unsaved changes"}</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`marks-${answerId}`}
            type="number"
            min="0"
            max={maximumMarks}
            value={marks}
            onChange={(e) => {
              setMarks(e.target.value);
              setErrorMsg(null);
            }}
            aria-describedby={errorMsg ? `error-${answerId}` : undefined}
            disabled={isSubmitting}
            className="w-20 bg-background border border-input rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          />
          <span className="text-secondary-foreground text-sm">/ {maximumMarks}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`feedback-${answerId}`} className="text-xs font-medium text-secondary-foreground block">
          Feedback
        </label>
        <textarea
          id={`feedback-${answerId}`}
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value);
            setErrorMsg(null);
          }}
          disabled={isSubmitting}
          rows={4}
          className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none disabled:opacity-50"
          placeholder="Add specific feedback for the student..."
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full font-semibold transition-all duration-200"
      >
        {isSubmitting ? "Approving..." : "Approve Answer"}
      </Button>
    </div>
  );
}
