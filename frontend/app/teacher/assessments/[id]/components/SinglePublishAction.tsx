"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { publishAttempt } from "../attempts/[attemptId]/actions";

interface SinglePublishActionProps {
  assessmentId: string;
  attemptId: string;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function SinglePublishAction({ assessmentId, attemptId, variant = "primary", size = "md" }: SinglePublishActionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePublish = async () => {
    setIsPublishing(true);
    setErrorMsg(null);
    try {
      const res = await publishAttempt(assessmentId, attemptId);
      if (res.success) {
        setIsModalOpen(false);
      } else {
        if (res.error === 'CONFLICT') {
          setErrorMsg("This result cannot be published (it may already be published or is no longer ready). Refreshing state.");
        } else if (res.error === 'UNAUTHORIZED') {
          setErrorMsg("Your session expired. Please log in again.");
        } else {
          setErrorMsg("Failed to publish result. Please try again.");
        }
      }
    } catch (e) {
      setErrorMsg("Failed to publish result. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setIsModalOpen(true)}>
        Publish Result
      </Button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => !isPublishing && setIsModalOpen(false)}
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative bg-surface rounded-lg shadow-lg border border-border w-full max-w-md overflow-hidden sm:my-8"
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Publish Result?</h3>
              <p className="text-sm text-secondary-foreground">
                Publishing makes this result visible to the student. You cannot undo this action.
              </p>

              {errorMsg && (
                <div className="mt-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3 py-2 rounded-md" role="alert" aria-live="assertive">
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="bg-secondary/10 px-6 py-4 flex items-center justify-end gap-3 rounded-b-lg">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                disabled={isPublishing}
                className="min-w-[120px]"
              >
                {isPublishing ? "Publishing..." : "Publish Result"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
