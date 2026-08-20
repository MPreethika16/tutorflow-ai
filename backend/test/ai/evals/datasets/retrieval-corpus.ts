import { QuestionType } from '../../../../src/generated/prisma/client';

export const EVAL_TEACHER_ID = '00000000-0000-0000-0000-000000000001';
export const EVAL_USER_ID = '00000000-0000-0000-0000-000000000001';

export type EvalCorpusQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  marks: number;
  order: number;
};

export type EvalCorpusAssessment = {
  id: string;
  board: string;
  grade: string;
  subject: string;
  title: string;
  questions: EvalCorpusQuestion[];
};

export const RETRIEVAL_EVAL_CORPUS: EvalCorpusAssessment[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    board: 'CBSE',
    grade: '10',
    subject: 'Science',
    title: 'Science Retrieval Benchmark Set',
    questions: [
      {
        id: '22222222-2222-2222-2222-222222222221',
        type: QuestionType.TYPED,
        prompt: 'Explain the role of photosynthesis in plant nutrition.',
        marks: 5,
        order: 1,
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        type: QuestionType.TYPED,
        prompt: 'State Newton\'s second law of motion and its formula.',
        marks: 3,
        order: 2,
      },
      {
        id: '22222222-2222-2222-2222-222222222223',
        type: QuestionType.TYPED,
        prompt: 'Describe the historical significance of New Delhi as the capital of India.',
        marks: 4,
        order: 3,
      },
      {
        id: '22222222-2222-2222-2222-222222222224',
        type: QuestionType.TYPED,
        prompt: 'How do carnivorous plants digest insects?',
        marks: 3,
        order: 4,
      }
    ]
  },
  {
    // Boundary test: Matches 'Newton' but is Subject: Math
    id: '11111111-1111-1111-1111-111111111112',
    board: 'CBSE',
    grade: '10',
    subject: 'Math',
    title: 'Math Retrieval Benchmark Set',
    questions: [
      {
        id: '22222222-2222-2222-2222-222222222225',
        type: QuestionType.TYPED,
        prompt: 'Solve the equation using Newton\'s method of approximation.',
        marks: 5,
        order: 1,
      }
    ]
  }
];
