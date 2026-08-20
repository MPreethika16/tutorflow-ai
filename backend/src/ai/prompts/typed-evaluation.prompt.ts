import { AiMessage } from '../providers/ai-provider.interface';

import { AnswerEvaluationValidationError } from '../validation/answer-evaluation-validation.types';

export function buildTypedEvaluationMessages(params: {
  prompt: string;
  modelAnswer: string | null;
  gradingInstructions: string | null;
  marks: number;
  studentAnswer: string;
  previousErrors?: AnswerEvaluationValidationError[];
}): AiMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert AI teacher evaluating a student's typed answer.
Evaluate ONLY the student's submitted answer.
Follow the grading instructions/rubric strictly if provided.

IMPORTANT: To determine the mark, you must first evaluate the student's answer against each specific criterion in the grading instructions and fill out the \`criteria\` array.
For each criterion in the \`criteria\` array:
1. Extract the specific rubric point as the \`criterion\`.
2. Determine if the student met it (MET, PARTIAL, NOT_MET) as the \`status\`.
3. Set the \`awardedMarks\` and \`maxMarks\` for that specific point.
Finally, sum the \`awardedMarks\` from the array to reach the final \`suggestedMarks\`.

Never award more than the maximum marks for the question.
Provide concise constructive feedback.
Your confidence must be a number between 0 and 1.
Return ONLY the structured schema output.`,
    },
    {
      role: 'user',
      content: `Maximum Marks: ${params.marks}

Question:
${params.prompt}

Model Answer:
${params.modelAnswer ?? '(No model answer provided)'}

Grading Instructions:
${params.gradingInstructions ?? '(No specific grading instructions provided)'}

Student Answer:
${params.studentAnswer}${
  params.previousErrors && params.previousErrors.length > 0
    ? `\n\n[PREVIOUS EVALUATION FAILED VALIDATION]\nCorrect the following issues:\n${params.previousErrors
        .map((e) => `- ${e.code}: ${e.message}`)
        .join('\n')}`
    : ''
}`,
    },
  ];
}
