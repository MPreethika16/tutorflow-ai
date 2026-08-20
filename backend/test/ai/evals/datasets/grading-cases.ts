import { GradingEvalCase } from './contracts';
import { QuestionType } from '../../../../src/generated/prisma/client';

const Q_PHOTOSYNTHESIS = {
  id: 'q-photo',
  type: QuestionType.TYPED,
  prompt: 'Explain the process of photosynthesis and its importance to life on Earth.',
  marks: 5,
  modelAnswer: 'Photosynthesis is the process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water...',
  gradingInstructions: 'Give up to 2 marks for explaining the process. Give 1 mark for mentioning chlorophyll or oxygen. Give up to 2 marks for explaining importance.',
};

const Q_CODE_SUM = {
  id: 'q-code',
  type: QuestionType.TYPED,
  prompt: 'Write a JavaScript function that takes an array of numbers and returns the sum.',
  marks: 3,
  modelAnswer: 'function sum(arr) { return arr.reduce((a, b) => a + b, 0); }',
  gradingInstructions: '1 mark for correct function signature. 2 marks for correct logic. Deduct 1 mark if it does not handle empty arrays properly.',
};

export const GRADING_EVAL_CASES: GradingEvalCase[] = [
  // Photosynthesis cases
  {
    id: 'grad-photo-1',
    description: 'clearly correct',
    question: Q_PHOTOSYNTHESIS as any,
    studentAnswer: { textAnswer: 'Photosynthesis is how plants make food using sunlight, water, and CO2. They use chlorophyll to do this, and release oxygen. It is crucial because it gives animals food to eat and oxygen to breathe.' } as any,
    expectedRange: [4, 5],
  },
  {
    id: 'grad-photo-2',
    description: 'mostly correct / partial',
    question: Q_PHOTOSYNTHESIS as any,
    studentAnswer: { textAnswer: 'Plants make their own food using sunlight. This is called photosynthesis. It keeps plants alive so we can eat them.' } as any,
    expectedRange: [2, 4],
  },
  {
    id: 'grad-photo-3',
    description: 'weak or incomplete',
    question: Q_PHOTOSYNTHESIS as any,
    studentAnswer: { textAnswer: 'its when plants grow in the sun' } as any,
    expectedRange: [1, 2],
  },
  {
    id: 'grad-photo-4',
    description: 'clearly incorrect',
    question: Q_PHOTOSYNTHESIS as any,
    studentAnswer: { textAnswer: 'Photosynthesis is when animals digest food to get energy.' } as any,
    expectedRange: [0, 1],
    expectedMarks: 0,
  },
  {
    id: 'grad-photo-5',
    description: 'empty answer',
    question: Q_PHOTOSYNTHESIS as any,
    studentAnswer: { textAnswer: '   ' } as any,
    expectedRange: [0, 0],
    expectedMarks: 0,
  },
  // Code cases
  {
    id: 'grad-code-1',
    description: 'clearly correct code',
    question: Q_CODE_SUM as any,
    studentAnswer: { textAnswer: 'const sum = (arr) => arr.reduce((a, b) => a + b, 0);' } as any,
    expectedRange: [3, 3],
    expectedMarks: 3,
  },
  {
    id: 'grad-code-2',
    description: 'mostly correct code (missing empty array check but functionally fine for non-empty)',
    question: Q_CODE_SUM as any,
    studentAnswer: { textAnswer: 'function sum(arr) { let total = 0; for(let n of arr) { total += n; } return total; }' } as any,
    expectedRange: [2, 2],
  },
  {
    id: 'grad-code-3',
    description: 'weak / incorrect logic code',
    question: Q_CODE_SUM as any,
    studentAnswer: { textAnswer: 'function sum(arr) { return arr[0] + arr[1]; }' } as any,
    expectedRange: [1, 2],
  },
];
