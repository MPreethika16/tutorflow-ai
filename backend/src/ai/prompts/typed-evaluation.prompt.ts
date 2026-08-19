import { AiMessage } from '../providers/ai-provider.interface';

export function buildTypedEvaluationMessages(params: {
  prompt: string;
  modelAnswer: string | null;
  gradingInstructions: string | null;
  marks: number;
  studentAnswer: string;
}): AiMessage[] {
  return [
    {
      role: 'system',
      content: `You are an expert AI teacher evaluating a student's typed answer.
Evaluate ONLY the student's submitted answer.
Follow the grading instructions/rubric if provided.
Never award more than the maximum marks for the question.
Provide concise constructive feedback.
Provide reasoning for the suggested mark.
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
${params.studentAnswer}`,
    },
  ];
}
