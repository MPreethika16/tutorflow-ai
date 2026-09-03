import React from "react";
import { StudentAnswerView } from "./StudentAnswerView";
import { TeacherFeedback } from "./TeacherFeedback";
import { Card, CardContent } from "@/components/ui/Card";

export interface QuestionResultAnswer {
  questionId: string;
  prompt: string;
  type: string;
  marks: number;
  maximumMarks: number;
  teacherFeedback: string | null;
  studentAnswer: {
    textAnswer: string | null;
    selectedOptionId: string | null;
    selectedOptionText: string | null;
    voiceUrl: string | null;
  } | null;
}

export interface QuestionResultCardProps {
  questionNumber: number;
  answer: QuestionResultAnswer;
}

export function QuestionResultCard({ questionNumber, answer }: QuestionResultCardProps) {
  return (
    <article>
      <Card className="bg-surface shadow-sm border-border overflow-hidden">
        <CardContent className="p-6 sm:p-8 space-y-6">

        {/* Question Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-2 flex-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-secondary-foreground">
              Question {questionNumber}
            </h3>
            <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap">
              {answer.prompt}
            </p>
          </div>

          <div className="flex-shrink-0 bg-secondary/30 px-3 py-1.5 rounded-md self-start">
            <span className="text-sm font-medium text-foreground">
              Score: {answer.marks} / {answer.maximumMarks}
            </span>
          </div>
        </div>

        {/* Student Answer */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
            Your Answer
          </h4>
          <StudentAnswerView
            type={answer.type}
            studentAnswer={answer.studentAnswer}
          />
        </div>

        {/* Teacher Feedback */}
        {answer.teacherFeedback && (
          <div className="pt-2">
            <TeacherFeedback feedback={answer.teacherFeedback} />
          </div>
        )}

        </CardContent>
      </Card>
    </article>
  );
}
