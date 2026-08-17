import {
  AssessmentKind,
} from '../../generated/prisma/client';

import type {
  GeneratedPaper,
} from '../contracts/generated-paper.schema';

import {
  validateGeneratedPaper,
} from './paper-validator';

describe('validateGeneratedPaper', () => {
  const request = {
    board: 'CBSE',
    grade: '10',
    subject: 'Mathematics',
    topic: 'Quadratic Equations',
    kind: AssessmentKind.TEST,
    totalMarks: 5,
    durationMinutes: 30,
  };

  const validPaper: GeneratedPaper = {
    title:
      'Quadratic Equations Test',

    instructions: [
      'Answer all questions.',
    ],

    durationMinutes: 30,

    totalMarks: 5,

    questions: [
      {
        type: 'MCQ',
        prompt:
          'Which expression is quadratic?',
        marks: 1,
        difficulty: 'EASY',

        options: [
          {
            id: 'A',
            text: 'x + 1',
          },
          {
            id: 'B',
            text:
              'x² + 2x + 1',
          },
        ],

        correctOption: 'B',

        explanation:
          'The highest power is 2.',
      },

      {
        type:
          'SHORT_ANSWER',

        prompt:
          'What does the discriminant tell us?',

        marks: 4,

        difficulty:
          'MEDIUM',

        modelAnswer:
          'It tells us the nature of the roots.',

        gradingInstructions:
          'Award marks for correctly explaining the nature of the roots.',
      },
    ],
  };

  it('accepts a valid paper', () => {
    const result =
      validateGeneratedPaper(
        request,
        validPaper,
      );

    expect(result).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('reports total marks mismatch', () => {
    const paper: GeneratedPaper = {
      ...validPaper,

      questions: [
        {
          ...validPaper.questions[0],
          marks: 1,
        },

        {
          ...validPaper.questions[1],
          marks: 2,
        },
      ],
    };

    const result =
      validateGeneratedPaper(
        request,
        paper,
      );

    expect(result.valid).toBe(false);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code:
            'TOTAL_MARKS_MISMATCH',
        }),
      ]),
    );
  });

  it('reports duration mismatch', () => {
    const result =
      validateGeneratedPaper(
        request,
        {
          ...validPaper,
          durationMinutes: 45,
        },
      );

    expect(result.valid).toBe(false);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code:
            'DURATION_MISMATCH',
        }),
      ]),
    );
  });

  it('reports duplicate questions after normalization', () => {
    const paper: GeneratedPaper = {
      ...validPaper,

      totalMarks: 2,

      questions: [
        {
          type: 'TRUE_FALSE',
          prompt:
            'A quadratic equation has degree 2.',
          marks: 1,
          difficulty: 'EASY',
          correctAnswer: true,
          explanation:
            'A quadratic equation is degree 2.',
        },

        {
          type: 'TRUE_FALSE',
          prompt:
            '  a QUADRATIC   equation has degree 2.  ',
          marks: 1,
          difficulty: 'EASY',
          correctAnswer: true,
          explanation:
            'A quadratic equation is degree 2.',
        },
      ],
    };

    const matchingRequest = {
      ...request,
      totalMarks: 2,
    };

    const result =
      validateGeneratedPaper(
        matchingRequest,
        paper,
      );

    expect(result.valid).toBe(false);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code:
            'DUPLICATE_QUESTION',
          questionIndex: 1,
        }),
      ]),
    );
  });

  it('reports an invalid MCQ correct option', () => {
    const paper: GeneratedPaper = {
      ...validPaper,

      totalMarks: 1,

      questions: [
        {
          type: 'MCQ',

          prompt:
            'Which expression is quadratic?',

          marks: 1,

          difficulty: 'EASY',

          options: [
            {
              id: 'A',
              text: 'x + 1',
            },
            {
              id: 'B',
              text:
                'x² + 2x + 1',
            },
          ],

          correctOption: 'C',

          explanation:
            'The highest power is 2.',
        },
      ],
    };

    const matchingRequest = {
      ...request,
      totalMarks: 1,
    };

    const result =
      validateGeneratedPaper(
        matchingRequest,
        paper,
      );

    expect(result.valid).toBe(false);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code:
            'MCQ_INVALID_CORRECT_OPTION',
          questionIndex: 0,
        }),
      ]),
    );
  });

  it('reports missing model answer', () => {
    const paper: GeneratedPaper = {
      ...validPaper,

      totalMarks: 5,

      questions: [
        {
          type:
            'SHORT_ANSWER',

          prompt:
            'Explain the discriminant.',

          marks: 5,

          difficulty:
            'MEDIUM',

          modelAnswer: '   ',

          gradingInstructions:
            'Award marks for a correct explanation.',
        },
      ],
    };

    const result =
      validateGeneratedPaper(
        request,
        paper,
      );

    expect(result.valid).toBe(false);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code:
            'MISSING_MODEL_ANSWER',
          questionIndex: 0,
        }),
      ]),
    );
  });

  it('reports missing grading instructions', () => {
    const paper: GeneratedPaper = {
      ...validPaper,

      totalMarks: 5,

      questions: [
        {
          type:
            'LONG_ANSWER',

          prompt:
            'Explain methods for solving quadratic equations.',

          marks: 5,

          difficulty:
            'HARD',

          modelAnswer:
            'Factorisation, completing the square, and the quadratic formula.',

          gradingInstructions:
            '   ',
        },
      ],
    };

    const result =
      validateGeneratedPaper(
        request,
        paper,
      );

    expect(result.valid).toBe(false);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code:
            'MISSING_GRADING_INSTRUCTIONS',
          questionIndex: 0,
        }),
      ]),
    );
  });

  it('can report multiple problems at once', () => {
    const paper: GeneratedPaper = {
      ...validPaper,

      durationMinutes: 45,

      questions: [
        {
          type:
            'SHORT_ANSWER',

          prompt:
            'Explain the discriminant.',

          marks: 2,

          difficulty:
            'MEDIUM',

          modelAnswer: '',

          gradingInstructions: '',
        },

        {
          type:
            'SHORT_ANSWER',

          prompt:
            ' explain   the discriminant. ',

          marks: 2,

          difficulty:
            'MEDIUM',

          modelAnswer:
            'Some answer',

          gradingInstructions:
            'Some grading guidance',
        },
      ],
    };

    const result =
      validateGeneratedPaper(
        request,
        paper,
      );

    expect(result.valid).toBe(false);

    expect(
      result.errors.map(
        (error) => error.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        'TOTAL_MARKS_MISMATCH',
        'DURATION_MISMATCH',
        'DUPLICATE_QUESTION',
        'MISSING_MODEL_ANSWER',
        'MISSING_GRADING_INSTRUCTIONS',
      ]),
    );
  });
});