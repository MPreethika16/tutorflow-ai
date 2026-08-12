import { generatedPaperSchema } from './generated-paper.schema';

describe('generatedPaperSchema', () => {
  const validPaper = {
    title: 'Quadratic Equations Revision',

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
            text: 'x² + 2x + 1',
          },
        ],

        correctOption: 'B',

        explanation:
          'The highest power of x is 2.',
      },

      {
        type: 'SHORT_ANSWER',
        prompt:
          'What does the discriminant tell us?',
        marks: 4,
        difficulty: 'MEDIUM',

        modelAnswer:
          'It indicates the nature of the roots.',

        gradingInstructions:
          'Award marks for correctly identifying the nature of roots.',
      },
    ],
  };

  it('accepts a valid generated paper', () => {
    const result =
      generatedPaperSchema.safeParse(
        validPaper,
      );

    expect(result.success).toBe(true);
  });

  it('rejects when totalMarks does not equal the sum of question marks', () => {
    const result =
      generatedPaperSchema.safeParse({
        ...validPaper,
        totalMarks: 10,
      });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message ===
            'totalMarks must equal the sum of question marks',
        ),
      ).toBe(true);
    }
  });

  it('rejects an MCQ when correctOption does not exist in options', () => {
    const paper = {
      ...validPaper,

      questions: [
        {
          type: 'MCQ',
          prompt:
            'Which expression is quadratic?',
          marks: 5,
          difficulty: 'EASY',

          options: [
            {
              id: 'A',
              text: 'x + 1',
            },
            {
              id: 'B',
              text: 'x² + 2x + 1',
            },
          ],

          correctOption: 'C',

          explanation:
            'The highest power of x is 2.',
        },
      ],
    };

    const result =
      generatedPaperSchema.safeParse(
        paper,
      );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.message ===
            'MCQ correctOption must match one of the option ids',
        ),
      ).toBe(true);
    }
  });

  it('rejects an MCQ without options', () => {
    const paper = {
      ...validPaper,

      totalMarks: 1,

      questions: [
        {
          type: 'MCQ',
          prompt:
            'Which expression is quadratic?',
          marks: 1,
          difficulty: 'EASY',

          correctOption: 'A',

          explanation:
            'The highest power of x is 2.',
        },
      ],
    };

    const result =
      generatedPaperSchema.safeParse(
        paper,
      );

    expect(result.success).toBe(false);
  });

  it('rejects a SHORT_ANSWER without modelAnswer', () => {
    const paper = {
      ...validPaper,

      totalMarks: 4,

      questions: [
        {
          type: 'SHORT_ANSWER',
          prompt:
            'What does the discriminant tell us?',
          marks: 4,
          difficulty: 'MEDIUM',

          gradingInstructions:
            'Award marks for identifying the nature of roots.',
        },
      ],
    };

    const result =
      generatedPaperSchema.safeParse(
        paper,
      );

    expect(result.success).toBe(false);
  });

  it('rejects an unsupported question type', () => {
    const paper = {
      ...validPaper,

      totalMarks: 1,

      questions: [
        {
          type: 'MATCH_THE_FOLLOWING',
          prompt: 'Match the columns.',
          marks: 1,
          difficulty: 'EASY',
        },
      ],
    };

    const result =
      generatedPaperSchema.safeParse(
        paper,
      );

    expect(result.success).toBe(false);
  });

  it('rejects a paper with no questions', () => {
    const result =
      generatedPaperSchema.safeParse({
        ...validPaper,
        totalMarks: 1,
        questions: [],
      });

    expect(result.success).toBe(false);
  });

  it('rejects zero duration', () => {
    const result =
      generatedPaperSchema.safeParse({
        ...validPaper,
        durationMinutes: 0,
      });

    expect(result.success).toBe(false);
  });
});