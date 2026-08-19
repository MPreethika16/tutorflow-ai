import { Test, TestingModule } from '@nestjs/testing';
import { AnswerEvaluationService, AnswerEvaluationValidationException } from './answer-evaluation.service';
import { McqEvaluatorService } from './mcq-evaluator.service';
import { TypedEvaluatorService } from './typed-evaluator.service';
import { Question, StudentAnswer, QuestionType } from '../../generated/prisma/client';
import { NotImplementedException } from '@nestjs/common';

describe('AnswerEvaluationService', () => {
  let service: AnswerEvaluationService;
  let mcqService: McqEvaluatorService;
  let typedService: TypedEvaluatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerEvaluationService,
        {
          provide: McqEvaluatorService,
          useValue: {
            evaluate: jest.fn(),
          },
        },
        {
          provide: TypedEvaluatorService,
          useValue: {
            evaluate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AnswerEvaluationService>(AnswerEvaluationService);
    mcqService = module.get<McqEvaluatorService>(McqEvaluatorService);
    typedService = module.get<TypedEvaluatorService>(TypedEvaluatorService);
  });

  const baseQuestion: Question = {
    id: 'q1',
    questionId: 'qid',
    assessmentId: 'a1',
    type: QuestionType.MCQ,
    prompt: 'Q?',
    marks: 10,
    order: 1,
    options: null,
    correctOption: null,
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
    selectedOption: null,
    textAnswer: null,
    voiceUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('MCQ routes only to McqEvaluatorService and returns valid evaluation', async () => {
    const mcqResult = { suggestedMarks: 10, feedback: 'Great', reasoning: 'Yes', confidence: 1 };
    jest.spyOn(mcqService, 'evaluate').mockReturnValue(mcqResult as any);

    const result = await service.evaluate(baseQuestion, baseAnswer);
    expect(mcqService.evaluate).toHaveBeenCalledTimes(1);
    expect(typedService.evaluate).not.toHaveBeenCalled();
    expect(result).toEqual(mcqResult);
  });

  it('TYPED routes only to TypedEvaluatorService and returns valid evaluation', async () => {
    const typedResult = { suggestedMarks: 5, feedback: 'Okay', reasoning: 'Yes', confidence: 0.8 };
    jest.spyOn(typedService, 'evaluate').mockResolvedValue(typedResult);

    const result = await service.evaluate({ ...baseQuestion, type: QuestionType.TYPED }, baseAnswer);
    expect(typedService.evaluate).toHaveBeenCalledTimes(1);
    expect(mcqService.evaluate).not.toHaveBeenCalled();
    expect(result).toEqual(typedResult);
  });

  it('TYPED routes retry context to TypedEvaluatorService', async () => {
    const typedResult = { suggestedMarks: 5, feedback: 'Okay', reasoning: 'Yes', confidence: 0.8 };
    jest.spyOn(typedService, 'evaluate').mockResolvedValue(typedResult);

    const context = { validationErrors: [{ code: 'EMPTY_FEEDBACK', message: 'err' }] };
    await service.evaluate({ ...baseQuestion, type: QuestionType.TYPED }, baseAnswer, context);
    
    expect(typedService.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ type: QuestionType.TYPED }),
      baseAnswer,
      context,
    );
  });

  it('MCQ routes but ignores retry context', async () => {
    const mcqResult = { suggestedMarks: 10, feedback: 'Great', reasoning: 'Yes', confidence: 1 };
    jest.spyOn(mcqService, 'evaluate').mockReturnValue(mcqResult as any);

    const context = { validationErrors: [{ code: 'EMPTY_FEEDBACK', message: 'err' }] };
    await service.evaluate(baseQuestion, baseAnswer, context);
    
    expect(mcqService.evaluate).toHaveBeenCalledWith(
      baseQuestion,
      baseAnswer,
    );
    const callArgs = (mcqService.evaluate as jest.Mock).mock.calls[0];
    expect(callArgs.length).toBe(2);
  });

  it('VOICE is rejected cleanly', async () => {
    await expect(
      service.evaluate({ ...baseQuestion, type: QuestionType.VOICE }, baseAnswer),
    ).rejects.toThrow(NotImplementedException);
    
    expect(mcqService.evaluate).not.toHaveBeenCalled();
    expect(typedService.evaluate).not.toHaveBeenCalled();
  });

  it('invalid evaluator output is rejected by deterministic validation', async () => {
    // over-scoring failure
    const badResult = { suggestedMarks: 20, feedback: 'Great', reasoning: 'Yes', confidence: 1 };
    jest.spyOn(mcqService, 'evaluate').mockReturnValue(badResult as any);

    await expect(service.evaluate(baseQuestion, baseAnswer)).rejects.toThrow(AnswerEvaluationValidationException);
  });

  it('MCQ evaluator failure propagates', async () => {
    jest.spyOn(mcqService, 'evaluate').mockImplementation(() => {
      throw new Error('MCQ Exploded');
    });

    await expect(service.evaluate(baseQuestion, baseAnswer)).rejects.toThrow('MCQ Exploded');
  });

  it('typed evaluator/provider failure propagates', async () => {
    jest.spyOn(typedService, 'evaluate').mockRejectedValue(new Error('Provider API Down'));

    await expect(service.evaluate({ ...baseQuestion, type: QuestionType.TYPED }, baseAnswer)).rejects.toThrow('Provider API Down');
  });

  it('maximum marks are passed correctly to validation', async () => {
    const badResult = { suggestedMarks: 10, feedback: 'Great', reasoning: 'Yes', confidence: 1 };
    jest.spyOn(mcqService, 'evaluate').mockReturnValue(badResult as any);

    // Question marks = 5, but result suggests 10. Should fail validation.
    await expect(service.evaluate({ ...baseQuestion, marks: 5 }, baseAnswer)).rejects.toThrow(AnswerEvaluationValidationException);
  });
});
