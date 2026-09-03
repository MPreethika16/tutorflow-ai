"use client";

import React, { useState, useRef } from "react";
import { AvailableAssessmentCard, type AvailableAssessmentItem } from "./AvailableAssessmentCard";
import { AttemptHistoryCard, type AttemptHistoryItem } from "./AttemptHistoryCard";

interface StudentDashboardClientProps {
  availableAssessments: AvailableAssessmentItem[];
  attemptHistory: AttemptHistoryItem[];
}

export function StudentDashboardClient({ availableAssessments, attemptHistory }: StudentDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"available" | "history">("available");
  const tabListRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation for tabs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!tabListRef.current) return;
    const tabs = Array.from(tabListRef.current.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    const currentIndex = tabs.findIndex(t => t.id === e.currentTarget.id);

    let nextIndex = null;
    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    }
  };

  return (
    <div className="space-y-6">
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Dashboard sections"
        className="flex space-x-2 border-b border-border pb-1"
      >
        <button
          role="tab"
          aria-selected={activeTab === "available"}
          aria-controls="panel-available"
          id="tab-available"
          tabIndex={activeTab === "available" ? 0 : -1}
          onClick={() => setActiveTab("available")}
          onKeyDown={handleKeyDown}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[2px] ${
            activeTab === "available"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-secondary-foreground hover:text-foreground hover:bg-secondary/30"
          }`}
        >
          Available <span className="ml-1.5 bg-secondary text-secondary-foreground py-0.5 px-2 rounded-full text-xs font-semibold">{availableAssessments.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "history"}
          aria-controls="panel-history"
          id="tab-history"
          tabIndex={activeTab === "history" ? 0 : -1}
          onClick={() => setActiveTab("history")}
          onKeyDown={handleKeyDown}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-[2px] ${
            activeTab === "history"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-secondary-foreground hover:text-foreground hover:bg-secondary/30"
          }`}
        >
          My History
        </button>
      </div>

      <div
        role="tabpanel"
        id="panel-available"
        aria-labelledby="tab-available"
        hidden={activeTab !== "available"}
        className="animate-in fade-in duration-200"
      >
        {activeTab === "available" && (
          <div className="space-y-4">
            {availableAssessments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-surface/50 border border-border border-dashed rounded-xl text-center space-y-3">
                <div className="w-12 h-12 bg-secondary/50 rounded-full flex items-center justify-center text-secondary-foreground">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-foreground font-medium text-lg">You&apos;re all caught up.</h3>
                  <p className="text-secondary-foreground text-sm mt-1">There are no assessments available right now.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {availableAssessments.map(assessment => (
                  <AvailableAssessmentCard key={assessment.assessmentId} assessment={assessment} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        role="tabpanel"
        id="panel-history"
        aria-labelledby="tab-history"
        hidden={activeTab !== "history"}
        className="animate-in fade-in duration-200"
      >
        {activeTab === "history" && (
          <div className="space-y-4">
            {attemptHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-surface/50 border border-border border-dashed rounded-xl text-center space-y-3">
                <div className="w-12 h-12 bg-secondary/50 rounded-full flex items-center justify-center text-secondary-foreground">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-foreground font-medium text-lg">No assessment history yet.</h3>
                  <p className="text-secondary-foreground text-sm mt-1">Once you start an assessment, it will appear here.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {attemptHistory.map(attempt => (
                  <AttemptHistoryCard key={attempt.attemptId} attempt={attempt} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
