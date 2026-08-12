import { QuestionType } from '../../generated/prisma/client';
import { mapGeneratedQuestion } from './generated-question.mapper';

describe('mapGeneratedQuestion', () => {
  it('maps MCQ to persisted MCQ', () => {
    const result = mapGeneratedQuestion({
      type: 'MCQ',
      prompt: 'Which expression is quadratic?',
      marks: 1,
      difficulty: 'EASY',
      options: [
        { id: 'A', text: 'x + 1' },
        { id: 'B', text: 'x² + 2x + 1' },
      ],
      correctOption: 'B',
      explanation: 'The highest power is 2.',
    });

    expect(result).toEqual({
      type: QuestionType.MCQ,
      prompt: 'Which expression is quadratic?',
      marks: 1,
      options: [
        { id: 'A', text: 'x + 1' },
        { id: 'B', text: 'x² + 2x + 1' },
      ],
      correctOption: 'B',
      explanation: 'The highest power is 2.',
      modelAnswer: null,
      gradingInstructions: null,
    });
  });

  it('maps TRUE_FALSE to MCQ with True and False options', () => {
    const result = mapGeneratedQuestion({
      type: 'TRUE_FALSE',
      prompt: 'A quadratic equation has degree 2.',
      marks: 1,
      difficulty: 'EASY',
      correctAnswer: true,
      explanation: 'Quadratic equations are second-degree equations.',
    });

    expect(result.type).toBe(QuestionType.MCQ);

    expect(result.options).toEqual([
      { id: 'A', text: 'True' },
      { id: 'B', text: 'False' },
    ]);

    expect(result.correctOption).toBe('A');
  });

  it('maps FALSE answer in TRUE_FALSE to option B', () => {
    const result = mapGeneratedQuestion({
      type: 'TRUE_FALSE',
      prompt: 'Every quadratic equation has two real roots.',
      marks: 1,
      difficulty: 'MEDIUM',
      correctAnswer: false,
      explanation: 'Some quadratic equations have complex roots.',
    });

    expect(result.correctOption).toBe('B');
  });

  it('maps FILL_BLANK to TYPED', () => {
    const result = mapGeneratedQuestion({
      type: 'FILL_BLANK',
      prompt: 'The highest power in a quadratic equation is ___.',
      marks: 1,
      difficulty: 'EASY',
      expectedAnswer: '2',
      explanation: 'Quadratic equations have degree 2.',
    });

    expect(result).toEqual({
      type: QuestionType.TYPED,
      prompt: 'The highest power in a quadratic equation is ___.',
      marks: 1,
      options: null,
      correctOption: null,
      explanation: 'Quadratic equations have degree 2.',
      modelAnswer: '2',
      gradingInstructions:
        'Award marks for a correct answer matching the expected answer.',
    });
  });

  it('maps SHORT_ANSWER to TYPED', () => {
    const result = mapGeneratedQuestion({
      type: 'SHORT_ANSWER',
      prompt: 'What does the discriminant tell us?',
      marks: 3,
      difficulty: 'MEDIUM',
      modelAnswer: 'It describes the nature of the roots.',
      gradingInstructions:
        'Award marks for correctly explaining the nature of the roots.',
    });

    expect(result.type).toBe(QuestionType.TYPED);
    expect(result.modelAnswer).toBe(
      'It describes the nature of the roots.',
    );
    expect(result.gradingInstructions).toBe(
      'Award marks for correctly explaining the nature of the roots.',
    );
    expect(result.options).toBeNull();
    expect(result.correctOption).toBeNull();
  });

  it('maps LONG_ANSWER to TYPED', () => {
    const result = mapGeneratedQuestion({
      type: 'LONG_ANSWER',
      prompt: 'Explain three methods for solving quadratic equations.',
      marks: 6,
      difficulty: 'HARD',
      modelAnswer:
        'Factorisation, completing the square, and the quadratic formula.',
      gradingInstructions:
        'Award marks for explaining each valid method clearly.',
    });

    expect(result.type).toBe(QuestionType.TYPED);
    expect(result.marks).toBe(6);
    expect(result.modelAnswer).toContain(
      'Factorisation',
    );
  });
});