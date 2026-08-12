import type {
  GeneratePaperDto,
} from '../dto/generate-paper.dto';

export function buildPaperGenerationMessages(
  dto: GeneratePaperDto,
) {
  const systemMessage = `
You generate academic assessment papers for TutorFlow.

Follow these rules:
- Generate only the requested academic paper.
- Match the requested board, grade, subject, topic, and difficulty level implied by the grade.
- Respect the requested total marks exactly.
- Respect the requested duration.
- Use only supported question types:
  MCQ,
  TRUE_FALSE,
  FILL_BLANK,
  SHORT_ANSWER,
  LONG_ANSWER.
- Every question must have positive integer marks.
- MCQ questions must contain options with unique ids and one valid correctOption.
- Descriptive questions must include model answers and grading instructions.
- Do not generate teacherId, assessmentId, status, source, timestamps, or database fields.
- Do not publish anything.
- Return content that matches the supplied structured schema.
`.trim();

  const userMessage = `
Create a ${dto.kind} paper.

Board: ${dto.board}
Grade: ${dto.grade}
Subject: ${dto.subject}
Topic: ${dto.topic}
Total marks: ${dto.totalMarks}
Duration: ${dto.durationMinutes} minutes

${
  dto.additionalInstructions
    ? `Additional instructions: ${dto.additionalInstructions}`
    : ''
}
`.trim();

  return [
    {
      role: 'system' as const,
      content: systemMessage,
    },
    {
      role: 'user' as const,
      content: userMessage,
    },
  ];
}