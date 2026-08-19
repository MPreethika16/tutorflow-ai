import { Test, TestingModule } from '@nestjs/testing';
import { McqEvaluatorService } from './mcq-evaluator.service';
import { Question, StudentAnswer, QuestionType } from '../../generated/prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('McqEvaluatorService', () => {
  let service: McqEvaluatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McqEvaluatorService],
    }).compile();

    service = module.get<McqEvaluatorService>(McqEvaluatorService);
  });

  const baseQuestion: Question = {
    id: 'q1',
    questionId: 'qid',
    assessmentId: 'a1',
    type: QuestionType.MCQ,
    prompt: 'Q?',
    marks: 5,
    order: 1,
    options: null,
    correctOption: 'A',
    explanation: null,
    modelAnswer: null,
    gradingInstructions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    embedding: null as any,
  };

  const baseAnswer: StudentAnswer = {
    id: 'a1',
    attemptId: 'att1',
    questionId: 'q1',
    selectedOption: 'A',
    textAnswer: null,
    voiceUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('correct MCQ gets full marks', () => {
    const result = service.evaluate(baseQuestion, baseAnswer);
    expect(result.suggestedMarks).toBe(5);
    expect(result.confidence).toBe(1);
    expect(result.feedback).toContain('Correct');
  });

  it('incorrect MCQ gets zero', () => {
    const result = service.evaluate(baseQuestion, { ...baseAnswer, selectedOption: 'B' });
    expect(result.suggestedMarks).toBe(0);
    expect(result.confidence).toBe(1);
    expect(result.feedback).toContain('Incorrect');
  });

  it('missing selectedOption is handled safely', () => {
    const result = service.evaluate(baseQuestion, { ...baseAnswer, selectedOption: null });
    expect(result.suggestedMarks).toBe(0);
    expect(result.confidence).toBe(1);
  });

  it('non-MCQ Question is rejected', () => {
    expect(() => service.evaluate({ ...baseQuestion, type: QuestionType.TYPED }, baseAnswer))
      .toThrow(BadRequestException);
  });
  
  it('maximum marks are never exceeded', () => {
    const result = service.evaluate({ ...baseQuestion, marks: 10 }, { ...baseAnswer, selectedOption: 'A' });
    expect(result.suggestedMarks).toBe(10);
    expect(result.suggestedMarks).toBeLessThanOrEqual(10); // Sanity check
  });
});
