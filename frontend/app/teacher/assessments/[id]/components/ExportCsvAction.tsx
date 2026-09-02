"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ExportCsvActionProps {
  assessmentId: string;
}

export function ExportCsvAction({ assessmentId }: ExportCsvActionProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setErrorMsg(null);

    try {
      // Direct authenticated client-side fetch.
      // NextJS will automatically include cookies since it's same-origin (or we use an API route proxy if needed)
      // Since our API is at NEXT_PUBLIC_API_URL, we need credentials: "include" if it's cross-origin,
      // but in this project the cookies are HTTP-only so we must use an internal Route Handler to attach them cleanly
      // Or we can just try to fetch the route handler we will create in app/api/export/[id]/route.ts

      const response = await fetch(`/api/assessments/${assessmentId}/export`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to export");
      }

      // Extract filename from Content-Disposition if present
      let filename = "results.csv";
      const disposition = response.headers.get("content-disposition");
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg("Failed to prepare export. Please try again.");
      setTimeout(() => setErrorMsg(null), 5000); // clear error after 5s
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative flex items-center gap-3">
      {errorMsg && (
        <span className="text-sm text-destructive font-medium animate-in fade-in slide-in-from-right-4">
          {errorMsg}
        </span>
      )}
      <Button
        variant="outline"
        onClick={handleExport}
        disabled={isExporting}
        className="min-w-[130px]"
      >
        {isExporting ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Preparing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </>
        )}
      </Button>
    </div>
  );
}
