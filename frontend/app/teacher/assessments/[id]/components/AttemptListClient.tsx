"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SinglePublishAction } from "./SinglePublishAction";
import { BulkPublishActionBar } from "./BulkPublishActionBar";

export interface TeacherAttemptListItem {
  attemptId: string;
  studentName: string;
  derivedStatus: string;
  submittedAt: string | null;
  finalMarks: number | null;
  maximumMarks: number;
}

interface AttemptListClientProps {
  assessmentId: string;
  attempts: TeacherAttemptListItem[];
}

export function AttemptListClient({ assessmentId, attempts }: AttemptListClientProps) {
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<Set<string>>(new Set());

  const readyToPublishAttempts = attempts.filter(a => a.derivedStatus === 'READY_TO_PUBLISH');
  const selectableIds = new Set(readyToPublishAttempts.map(a => a.attemptId));

  // Filter out any IDs that are no longer selectable (e.g. after a successful publish refresh)
  const validSelectedIds = Array.from(selectedAttemptIds).filter(id => selectableIds.has(id));
  const allSelected = readyToPublishAttempts.length > 0 && validSelectedIds.length === readyToPublishAttempts.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedAttemptIds(new Set());
    } else {
      setSelectedAttemptIds(selectableIds);
    }
  };

  const toggleSelectAttempt = (attemptId: string) => {
    const newSelected = new Set(selectedAttemptIds);
    if (newSelected.has(attemptId)) {
      newSelected.delete(attemptId);
    } else {
      newSelected.add(attemptId);
    }
    setSelectedAttemptIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedAttemptIds(new Set());
  };

  return (
    <>
      {validSelectedIds.length > 0 && (
        <BulkPublishActionBar
          assessmentId={assessmentId}
          selectedAttemptIds={validSelectedIds}
          onClearSelection={clearSelection}
        />
      )}

      {/* Desktop Table */}
      <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-surface">
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/50 text-secondary-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-4 w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={readyToPublishAttempts.length === 0}
                  className="rounded border-input text-primary focus:ring-primary disabled:opacity-50"
                  aria-label="Select all ready to publish results"
                />
              </th>
              <th className="px-6 py-4 font-medium">Student</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Submitted</th>
              <th className="px-6 py-4 font-medium">Score</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {attempts.map((attempt: TeacherAttemptListItem) => {
              const isSelectable = attempt.derivedStatus === 'READY_TO_PUBLISH';
              const isSelected = selectedAttemptIds.has(attempt.attemptId);

              return (
                <tr
                  key={attempt.attemptId}
                  className={`transition-colors group ${isSelected ? 'bg-primary/5' : 'hover:bg-secondary/30'} ${!isSelectable ? 'opacity-80' : ''}`}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectAttempt(attempt.attemptId)}
                      disabled={!isSelectable}
                      className="rounded border-input text-primary focus:ring-primary disabled:opacity-50"
                      aria-label={`Select student ${attempt.studentName} for publication`}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                    {attempt.studentName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={attempt.derivedStatus} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-secondary-foreground">
                    {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {attempt.finalMarks !== null ? (
                      <span className="font-medium text-foreground">{attempt.finalMarks} / {attempt.maximumMarks}</span>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
                    {attempt.derivedStatus === 'READY_TO_PUBLISH' && (
                      <SinglePublishAction
                        assessmentId={assessmentId}
                        attemptId={attempt.attemptId}
                        variant="ghost"
                        size="sm"
                      />
                    )}
                    {['WAITING_FOR_REVIEW', 'READY_TO_PUBLISH', 'FAILED'].includes(attempt.derivedStatus) ? (
                      <Link
                        href={`/teacher/assessments/${assessmentId}/attempts/${attempt.attemptId}`}
                        className="text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1 inline-block"
                      >
                        Review
                      </Link>
                    ) : attempt.derivedStatus === 'PUBLISHED' ? (
                      <Link
                        href={`/teacher/assessments/${assessmentId}/attempts/${attempt.attemptId}`}
                        className="text-info font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1 inline-block"
                      >
                        View Result
                      </Link>
                    ) : (
                      <span className="text-secondary-foreground px-2 py-1 inline-block">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {/* Mobile Select All */}
        {readyToPublishAttempts.length > 0 && (
          <div className="flex items-center gap-3 bg-surface border border-border rounded-lg p-4">
            <input
              type="checkbox"
              id="mobile-select-all"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="rounded border-input text-primary focus:ring-primary w-5 h-5"
            />
            <label htmlFor="mobile-select-all" className="font-medium text-foreground text-sm">
              Select all ready to publish ({readyToPublishAttempts.length})
            </label>
          </div>
        )}

        {attempts.map((attempt: TeacherAttemptListItem) => {
          const isSelectable = attempt.derivedStatus === 'READY_TO_PUBLISH';
          const isSelected = selectedAttemptIds.has(attempt.attemptId);

          return (
            <div key={attempt.attemptId} className={`border rounded-lg p-4 transition-colors space-y-3 ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-surface'} ${!isSelectable ? 'opacity-90' : ''}`}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-start gap-3 flex-1">
                  {isSelectable && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectAttempt(attempt.attemptId)}
                      className="rounded border-input text-primary focus:ring-primary mt-1 w-5 h-5"
                      aria-label={`Select student ${attempt.studentName} for publication`}
                    />
                  )}
                  <div>
                    <h3 className="font-medium text-foreground">{attempt.studentName}</h3>
                    <div className="text-sm text-secondary-foreground mt-0.5">
                      {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString() : '—'}
                    </div>
                  </div>
                </div>
                <StatusBadge status={attempt.derivedStatus} />
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary-foreground font-medium">Score</span>
                <span className="font-medium text-foreground">
                  {attempt.finalMarks !== null ? `${attempt.finalMarks} / ${attempt.maximumMarks}` : 'Pending'}
                </span>
              </div>

              <div className="pt-3 border-t border-border mt-2 flex flex-col gap-2">
                {attempt.derivedStatus === 'READY_TO_PUBLISH' && (
                  <SinglePublishAction
                    assessmentId={assessmentId}
                    attemptId={attempt.attemptId}
                  />
                )}
                {['WAITING_FOR_REVIEW', 'READY_TO_PUBLISH', 'FAILED'].includes(attempt.derivedStatus) ? (
                  <Link
                    href={`/teacher/assessments/${assessmentId}/attempts/${attempt.attemptId}`}
                    className="block w-full text-center bg-secondary/30 text-foreground py-2 rounded-md font-medium text-sm hover:bg-secondary/50 transition-colors"
                  >
                    Review Attempt
                  </Link>
                ) : attempt.derivedStatus === 'PUBLISHED' ? (
                  <Link
                    href={`/teacher/assessments/${assessmentId}/attempts/${attempt.attemptId}`}
                    className="block w-full text-center border border-info text-info py-2 rounded-md font-medium text-sm hover:bg-info/10 transition-colors"
                  >
                    View Result
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
