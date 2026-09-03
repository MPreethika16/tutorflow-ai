"use client";

import React, { useState } from "react";
import { AttemptListClient, type TeacherAttemptListItem } from "./AttemptListClient";
import { AssessmentAnalytics, type AssessmentAnalyticsData } from "./AssessmentAnalytics";
import { ExportCsvAction } from "./ExportCsvAction";

interface AssessmentTabsProps {
  assessmentId: string;
  attempts: TeacherAttemptListItem[];
  analytics: AssessmentAnalyticsData;
}

export function AssessmentTabs({ assessmentId, attempts, analytics }: AssessmentTabsProps) {
  const [activeTab, setActiveTab] = useState<"attempts" | "analytics">("attempts");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div
          role="tablist"
          aria-label="Assessment views"
          className="flex space-x-1 bg-secondary/20 p-1 rounded-lg self-start"
        >
          <button
            role="tab"
            aria-selected={activeTab === "attempts"}
            aria-controls="panel-attempts"
            id="tab-attempts"
            onClick={() => setActiveTab("attempts")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === "attempts"
                ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
                : "text-secondary-foreground hover:text-foreground hover:bg-secondary/30"
            }`}
          >
            Student Attempts
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "analytics"}
            aria-controls="panel-analytics"
            id="tab-analytics"
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === "analytics"
                ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
                : "text-secondary-foreground hover:text-foreground hover:bg-secondary/30"
            }`}
          >
            Analytics & Results
          </button>
        </div>

        {activeTab === "analytics" && analytics.summary.publishedResults > 0 && (
          <ExportCsvAction assessmentId={assessmentId} />
        )}
      </div>

      {/* Tab Panels */}
      <div
        role="tabpanel"
        id="panel-attempts"
        aria-labelledby="tab-attempts"
        hidden={activeTab !== "attempts"}
      >
        {activeTab === "attempts" && (
          <div>
            {attempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-surface border border-border rounded-lg shadow-sm text-center">
                <p className="text-foreground font-medium">No student attempts yet.</p>
                <p className="text-secondary-foreground text-sm mt-1">When students submit this assessment, their attempts will appear here.</p>
              </div>
            ) : (
              <AttemptListClient assessmentId={assessmentId} attempts={attempts} />
            )}
          </div>
        )}
      </div>

      <div
        role="tabpanel"
        id="panel-analytics"
        aria-labelledby="tab-analytics"
        hidden={activeTab !== "analytics"}
      >
        {activeTab === "analytics" && (
          <AssessmentAnalytics assessmentId={assessmentId} analytics={analytics} />
        )}
      </div>
    </div>
  );
}
