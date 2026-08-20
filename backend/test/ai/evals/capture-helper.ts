import * as fs from 'fs';
import { AnswerEvaluationResult } from '../../../src/ai/evaluators/answer-evaluation-result';
import { validateAnswerEvaluation } from '../../../src/ai/validation/answer-evaluation-validator';
import { GradingEvalCase } from './datasets/contracts';
import { GradingCapture } from './datasets/grading-replay.fixture';

export const CURRENT_DATASET_VERSION = 'grading-v1.1';

export function attemptCapture(
  tc: GradingEvalCase,
  result: AnswerEvaluationResult,
  captures: GradingCapture[],
  fixturePath: string,
  model: string = 'LLM_PROVIDER'
): { captured: boolean; skipped: boolean; validationFailures: number } {
  const existing = captures.find((c) => c.caseId === tc.id);
  if (existing) {
    return { captured: false, skipped: true, validationFailures: 0 };
  }

  const validation = validateAnswerEvaluation(result, tc.question.marks);
  if (!validation.valid) {
    return { captured: false, skipped: false, validationFailures: 1 };
  }

  captures.push({
    caseId: tc.id,
    result,
    captureMetadata: {
      model,
      capturedAt: new Date().toISOString(),
      datasetVersion: CURRENT_DATASET_VERSION,
      captureSource: 'LLM',
    },
  });

  fs.writeFileSync(fixturePath, JSON.stringify(captures, null, 2), 'utf8');
  return { captured: true, skipped: false, validationFailures: 0 };
}
