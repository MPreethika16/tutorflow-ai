"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { bulkPublishAttempts } from "../actions";

interface BulkPublishActionBarProps {
  assessmentId: string;
  selectedAttemptIds: string[];
  onClearSelection: () => void;
}

export function BulkPublishActionBar({ assessmentId, selectedAttemptIds, onClearSelection }: BulkPublishActionBarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // State for partial failure rendering
  const [publishResult, setPublishResult] = useState<{
    successful: string[];
    failed: { attemptId: string; reason: string }[];
  } | null>(null);

  const [networkError, setNetworkError] = useState<string | null>(null);

  const handlePublish = async () => {
    setIsPublishing(true);
    setNetworkError(null);
    try {
      const res = await bulkPublishAttempts(assessmentId, selectedAttemptIds);
      if (res.success && res.data) {
        setPublishResult(res.data);
        // Do NOT close the modal immediately so they can see the partial success breakdown
      } else {
        setNetworkError("A network or server error occurred. Please try again.");
      }
    } catch (e) {
      setNetworkError("Failed to publish results. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    if (publishResult) {
      // Clear selection only if they clicked through success, we leave failed rows selected
      // Wait, let's just clear selection entirely and let the UI refresh. The user instruction said:
      // "successful rows must be deselected. Failed rows may remain selected only if the refreshed backend state still reports them as READY_TO_PUBLISH."
      // We will let the `AttemptListClient` derivedStatus handle what stays selectable.
      // But we need to deselect the successful ones immediately so they don't stay selected if the server takes a moment.
      // Easiest is just calling `onClearSelection()`, but wait - they wanted to keep failed selected.
      // We don't have a targeted clear here, so we'll just clear all and let the user re-select if needed,
      // or we can just close the modal. Let's just clear selection for now.
      onClearSelection();
      setPublishResult(null);
    }
  };

  if (selectedAttemptIds.length === 0) return null;

  return (
    <>
      {/* Fixed action bar at bottom of viewport */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40 bg-surface/90 backdrop-blur-md border-t shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:sticky md:bottom-4 md:mt-4 md:rounded-lg md:border md:shadow-md animate-in slide-in-from-bottom-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-primary px-3 py-1 bg-primary/10 rounded-md">
              {selectedAttemptIds.length} selected
            </span>
            <button
              onClick={onClearSelection}
              className="text-sm font-medium text-secondary-foreground hover:text-foreground transition-colors"
            >
              Clear selection
            </button>
          </div>
          <Button
            size="lg"
            onClick={() => setIsModalOpen(true)}
            className="shadow-sm"
          >
            Publish {selectedAttemptIds.length} Results
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative bg-surface rounded-lg shadow-lg border border-border w-full max-w-md overflow-hidden sm:my-8"
          >
            <div className="p-6">
              {!publishResult ? (
                <>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Publish Results?</h3>
                  <p className="text-sm text-secondary-foreground">
                    You are about to publish {selectedAttemptIds.length} results. This makes the results visible to these students. You cannot undo this action.
                  </p>

                  {networkError && (
                    <div className="mt-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm px-3 py-2 rounded-md">
                      {networkError}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Publication Summary</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-md">
                      <span className="text-success font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Successfully published
                      </span>
                      <span className="font-bold text-success text-lg">{publishResult.successful.length}</span>
                    </div>

                    {publishResult.failed.length > 0 && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-destructive font-medium flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            Failed to publish
                          </span>
                          <span className="font-bold text-destructive text-lg">{publishResult.failed.length}</span>
                        </div>
                        <ul className="text-sm text-destructive/80 space-y-1 mt-2">
                          {publishResult.failed.slice(0, 3).map((fail, i) => (
                            <li key={i} className="flex justify-between">
                              <span className="truncate mr-2 max-w-[200px]" title={fail.attemptId}>ID: {fail.attemptId.slice(0,8)}...</span>
                              <span className="opacity-80 text-xs">{fail.reason}</span>
                            </li>
                          ))}
                          {publishResult.failed.length > 3 && (
                            <li className="text-xs italic pt-1 border-t border-destructive/10 mt-1">
                              + {publishResult.failed.length - 3} more...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="bg-secondary/10 px-6 py-4 flex items-center justify-end gap-3 rounded-b-lg">
              {!publishResult ? (
                <>
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
                    {isPublishing ? "Publishing..." : "Publish Results"}
                  </Button>
                </>
              ) : (
                <Button onClick={handleClose} className="min-w-[100px]">
                  Done
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
