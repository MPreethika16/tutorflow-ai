import type {
  GeneratedPaper,
} from '../contracts/generated-paper.schema';

import type {
  GeneratePaperDto,
} from '../dto/generate-paper.dto';

import type {
  PaperValidationError,
} from '../validation/paper-validation.types';

export function buildPaperRepairMessages(
  request: GeneratePaperDto,
  paper: GeneratedPaper,
  errors: PaperValidationError[],
) {
  const systemMessage = `
You repair academic assessment papers for TutorFlow.

You are given:
- the original assessment request
- the currently generated paper
- deterministic validation errors produced by TutorFlow

Repair rules:
- Fix the listed validation problems.
- Preserve valid questions and content whenever possible.
- Make the smallest reasonable changes needed.
- Do not change the requested board, grade, subject, or topic.
- Respect the requested total marks exactly.
- Respect the requested duration exactly.
- Use only supported question types:
  MCQ,
  TRUE_FALSE,
  FILL_BLANK,
  SHORT_ANSWER,
  LONG_ANSWER.
- Keep MCQ option ids valid and ensure correctOption matches an option id.
- Keep model answers and grading instructions for descriptive questions.
- Do not generate teacherId, assessmentId, status, source, timestamps, or database fields.
- Do not publish anything.
- Return a complete repaired paper matching the supplied structured schema.
`.trim();

  const errorText = errors
    .map(
      (error, index) =>
        `${index + 1}. [${error.code}] ${error.message}`,
    )
    .join('\n');

  const userMessage = `
Original request:

Board: ${request.board}
Grade: ${request.grade}
Subject: ${request.subject}
Topic: ${request.topic}
Kind: ${request.kind}
Total marks: ${request.totalMarks}
Duration: ${request.durationMinutes} minutes

Validation errors:

${errorText}

Current paper:

${JSON.stringify(
  paper,
  null,
  2,
)}

Repair the paper while preserving valid content wherever possible.
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