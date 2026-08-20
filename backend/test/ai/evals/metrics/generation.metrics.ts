import { Paper } from '../../../../src/ai/contracts/generated-paper.schema';
import { QuestionType } from '../../../../src/generated/prisma/client';

export function isSchemaValid(paper: unknown): boolean {
  return !!paper && typeof paper === 'object' && Array.isArray((paper as any).questions);
}

export function totalMarksCorrectness(paper: Paper, expectedTotal: number): boolean {
  if (!paper || !paper.questions) return false;
  const sum = paper.questions.reduce((acc, q) => acc + (q.marks || 0), 0);
  return sum === expectedTotal;
}

export function requiredTypedFieldsCompletion(paper: Paper): boolean {
  if (!paper || !paper.questions) return false;
  const typedQs = paper.questions.filter((q) => q.type === QuestionType.TYPED);
  if (typedQs.length === 0) return true; // trivially complete
  return typedQs.every(
    (q) =>
      typeof q.modelAnswer === 'string' &&
      q.modelAnswer.trim().length > 0 &&
      typeof q.gradingInstructions === 'string' &&
      q.gradingInstructions.trim().length > 0,
  );
}
