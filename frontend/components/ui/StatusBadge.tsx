import * as React from "react";

export function StatusBadge({ status }: { status: string }) {
  let badgeColor = "bg-secondary text-secondary-foreground";
  let label = status || "UNKNOWN";

  // Assessment Statuses
  if (status === "PUBLISHED" || status === "ACTIVE") {
    badgeColor = "bg-success/10 text-success border border-success/20";
    label = status === "PUBLISHED" ? "Published" : "Active";
  } else if (status === "DRAFT") {
    badgeColor = "bg-warning/10 text-warning-foreground border border-warning/20";
    label = "Draft";
  } else if (status === "CLOSED") {
    badgeColor = "bg-surface border border-border text-foreground/70";
    label = "Closed";
  } else if (status === "ARCHIVED") {
    badgeColor = "bg-surface border border-border text-foreground/70";
    label = "Archived";
  }

  // Attempt Statuses mapping based on User prompt:
  // IN_PROGRESS -> In progress (informational)
  // GRADING -> Grading (informational)
  // WAITING_FOR_REVIEW -> Needs review (highest attention)
  // READY_TO_PUBLISH -> Ready to publish (actionable)
  // FAILED -> Needs attention (highest attention)
  else if (status === "IN_PROGRESS") {
    badgeColor = "bg-secondary text-secondary-foreground border border-border";
    label = "In progress";
  } else if (status === "GRADING") {
    badgeColor = "bg-secondary text-secondary-foreground border border-border";
    label = "Grading";
  } else if (status === "WAITING_FOR_REVIEW") {
    badgeColor = "bg-warning/10 text-warning-foreground border border-warning/20 font-semibold";
    label = "Needs review";
  } else if (status === "READY_TO_PUBLISH") {
    badgeColor = "bg-info/10 text-info border border-info/20 font-semibold";
    label = "Ready to publish";
  } else if (status === "FAILED") {
    badgeColor = "bg-destructive/10 text-destructive border border-destructive/20 font-semibold";
    label = "Needs attention";
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
      {label}
    </span>
  );
}
