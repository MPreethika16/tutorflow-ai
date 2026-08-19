import { buildTypedEvaluationMessages } from './typed-evaluation.prompt';
import { AnswerEvaluationValidationError } from '../validation/answer-evaluation-validation.types';

describe('typed-evaluation.prompt', () => {
  it('no retry errors -> original prompt remains unchanged', () => {
    const messages = buildTypedEvaluationMessages({
      prompt: 'Q',
      modelAnswer: 'A',
      gradingInstructions: null,
      marks: 10,
      studentAnswer: 'Student A',
    });

    const userMessage = messages.find(m => m.role === 'user')!;
    expect(userMessage.content).not.toContain('[PREVIOUS EVALUATION FAILED VALIDATION]');
    expect(userMessage.content).toContain('Student Answer:\nStudent A');
  });

  it('retry errors -> corrective block is appended with code and message', () => {
    const previousErrors: AnswerEvaluationValidationError[] = [
      { code: 'MARKS_EXCEED_MAXIMUM', message: 'Suggested marks (12) exceed maximum marks (10).' },
      { code: 'INVALID_CONFIDENCE', message: 'Confidence (1.2) must be between 0 and 1.' }
    ];

    const messages = buildTypedEvaluationMessages({
      prompt: 'Q',
      modelAnswer: 'A',
      gradingInstructions: null,
      marks: 10,
      studentAnswer: 'Student A',
      previousErrors,
    });

    const userMessage = messages.find(m => m.role === 'user')!;
    expect(userMessage.content).toContain('[PREVIOUS EVALUATION FAILED VALIDATION]');
    expect(userMessage.content).toContain('- MARKS_EXCEED_MAXIMUM: Suggested marks (12) exceed maximum marks (10).');
    expect(userMessage.content).toContain('- INVALID_CONFIDENCE: Confidence (1.2) must be between 0 and 1.');
  });
});
