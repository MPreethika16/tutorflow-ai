import { AnswerEvaluationResult } from '../../../../src/ai/evaluators/answer-evaluation-result';

export interface GradingCapture {
  caseId: string;
  result: AnswerEvaluationResult;
  captureMetadata: {
    model?: string;
    capturedAt: string;
    datasetVersion: string;
    captureSource: 'LLM' | 'DETERMINISTIC_BYPASS';
  };
}

export const GRADING_CAPTURES: GradingCapture[] = [
  {
    caseId: 'grad-photo-5', // The deterministic empty-answer bypass
    result: {
      suggestedMarks: 0,
      criteria: [
        {
          criterion: 'Answered question',
          awardedMarks: 0,
          maxMarks: 5, // Q_PHOTOSYNTHESIS has 5 marks
          status: 'NOT_MET',
        },
      ],
      feedback: 'No answer was provided.',
      reasoning: 'The student did not submit a written answer.',
      confidence: 1,
    },
    captureMetadata: {
      model: 'BYPASS_LOCAL',
      capturedAt: '2026-08-20T10:00:00Z',
      datasetVersion: 'grading-v1.1',
      captureSource: 'DETERMINISTIC_BYPASS',
    },
  },
];
