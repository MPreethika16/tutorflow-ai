import React from "react";

interface TeacherFeedbackProps {
  feedback: string;
}

export function TeacherFeedback({ feedback }: TeacherFeedbackProps) {
  return (
    <div className="border-l-4 border-primary pl-4 py-1">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
        Teacher Feedback
      </h4>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {feedback}
      </p>
    </div>
  );
}
