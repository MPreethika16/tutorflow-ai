import React from "react";

interface StudentAnswerViewProps {
  type: string;
  studentAnswer: {
    textAnswer: string | null;
    selectedOptionId: string | null;
    selectedOptionText: string | null;
    voiceUrl: string | null;
  } | null;
}

export function StudentAnswerView({ type, studentAnswer }: StudentAnswerViewProps) {
  if (!studentAnswer) {
    return (
      <div className="bg-secondary/10 border border-border/50 rounded-md p-4 text-secondary-foreground italic text-sm">
        No answer submitted.
      </div>
    );
  }

  if (type === "TYPED") {
    if (!studentAnswer.textAnswer) {
      return (
        <div className="bg-secondary/10 border border-border/50 rounded-md p-4 text-secondary-foreground italic text-sm">
          No answer submitted.
        </div>
      );
    }
    return (
      <div className="bg-secondary/10 border border-border/50 rounded-md p-4 text-foreground whitespace-pre-wrap text-sm">
        {studentAnswer.textAnswer}
      </div>
    );
  }

  if (type === "MCQ") {
    if (studentAnswer.selectedOptionText) {
      return (
        <div className="bg-secondary/10 border border-border/50 rounded-md p-4 flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-4 border-primary flex-shrink-0" />
          <span className="text-foreground text-sm font-medium">
            {studentAnswer.selectedOptionText}
          </span>
        </div>
      );
    }
    return (
      <div className="bg-secondary/10 border border-border/50 rounded-md p-4 text-secondary-foreground italic text-sm">
        Selected answer unavailable.
      </div>
    );
  }

  if (type === "VOICE") {
    if (!studentAnswer.voiceUrl) {
      return (
        <div className="bg-secondary/10 border border-border/50 rounded-md p-4 text-secondary-foreground italic text-sm">
          No answer submitted.
        </div>
      );
    }
    return (
      <div className="bg-secondary/10 border border-border/50 rounded-md p-4">
        <audio
          controls
          className="w-full h-10 max-w-md"
          src={studentAnswer.voiceUrl}
          aria-label="Play submitted voice answer"
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  return (
    <div className="bg-secondary/10 border border-border/50 rounded-md p-4 text-secondary-foreground italic text-sm">
      Unsupported answer type.
    </div>
  );
}
