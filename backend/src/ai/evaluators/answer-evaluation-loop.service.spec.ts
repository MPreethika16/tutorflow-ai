import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationLoopService, isRetryableEvaluationError } from './answer-evaluation-loop.service';
import { AnswerEvaluationService, AnswerEvaluationValidationException } from './answer-evaluation.service';
import { AiProviderError } from '../errors/ai-provider.error';
import type { Question, StudentAnswer } from '../../../generated/prisma/client';
import { NotImplementedException } from '@nestjs/common';

describe('EvaluationLoopService', () => {
  let service: EvaluationLoopService;
  let answerEvaluationService: jest.Mocked<AnswerEvaluationService>;

  const mockQuestion = { id: 'q1' } as Question;
  const mockStudentAnswer = { id: 'sa1' } as StudentAnswer;
  const mockResult = {
    suggestedMarks: 5,
    feedback: 'Good',
    reasoning: 'Correct',
    confidence: 1,
  };

  beforeEach(async () => {
    answerEvaluationService = {
      evaluate: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationLoopService,
        {
          provide: AnswerEvaluationService,
          useValue: answerEvaluationService,
        },
      ],
    }).compile();

    service = module.get<EvaluationLoopService>(EvaluationLoopService);
  });

  describe('isRetryableEvaluationError', () => {
    it('returns true for AnswerEvaluationValidationException', () => {
      expect(
        isRetryableEvaluationError(
          new AnswerEvaluationValidationException({
            valid: false,
            errors: [{ code: 'EMPTY_FEEDBACK', message: 'err' }]
          }),
        ),
      ).toBe(true);
    });

    it.each(['INVALID_RESPONSE', 'RATE_LIMIT', 'TIMEOUT', 'UNAVAILABLE'] as const)(
      'returns true for AiProviderError with code %s',
      (code) => {
        expect(isRetryableEvaluationError(new AiProviderError(code, 'err'))).toBe(true);
      },
    );

    it.each(['CONFIGURATION', 'AUTHENTICATION', 'UNKNOWN'] as const)(
      'returns false for AiProviderError with code %s',
      (code) => {
        expect(isRetryableEvaluationError(new AiProviderError(code, 'err'))).toBe(false);
      },
    );

    it('returns false for NotImplementedException', () => {
      expect(isRetryableEvaluationError(new NotImplementedException())).toBe(false);
    });

    it('returns false for generic errors', () => {
      expect(isRetryableEvaluationError(new Error('generic'))).toBe(false);
    });
  });

  describe('evaluate', () => {
    it('succeeds on first attempt', async () => {
      answerEvaluationService.evaluate.mockResolvedValue(mockResult);

      const result = await service.evaluate(mockQuestion, mockStudentAnswer);
      expect(result).toBe(mockResult);
      expect(answerEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    });

    it('fails once with validation error, then succeeds', async () => {
      answerEvaluationService.evaluate
        .mockRejectedValueOnce(new AnswerEvaluationValidationException({ valid: false, errors: [] }))
        .mockResolvedValueOnce(mockResult);

      const result = await service.evaluate(mockQuestion, mockStudentAnswer);
      expect(result).toBe(mockResult);
      expect(answerEvaluationService.evaluate).toHaveBeenCalledTimes(2);
    });

    it('fails twice, then succeeds', async () => {
      answerEvaluationService.evaluate
        .mockRejectedValueOnce(new AiProviderError('RATE_LIMIT', 'err'))
        .mockRejectedValueOnce(new AiProviderError('TIMEOUT', 'err'))
        .mockResolvedValueOnce(mockResult);

      const result = await service.evaluate(mockQuestion, mockStudentAnswer);
      expect(result).toBe(mockResult);
      expect(answerEvaluationService.evaluate).toHaveBeenCalledTimes(3);
    });

    it('fails 3 times -> final failure', async () => {
      const error = new AiProviderError('UNAVAILABLE', 'err');
      answerEvaluationService.evaluate.mockRejectedValue(error);

      await expect(service.evaluate(mockQuestion, mockStudentAnswer)).rejects.toThrow(error);
      expect(answerEvaluationService.evaluate).toHaveBeenCalledTimes(3);
    });

    it('does not retry CONFIGURATION error', async () => {
      const error = new AiProviderError('CONFIGURATION', 'err');
      answerEvaluationService.evaluate.mockRejectedValue(error);

      await expect(service.evaluate(mockQuestion, mockStudentAnswer)).rejects.toThrow(error);
      expect(answerEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    });

    it('does not retry AUTHENTICATION error', async () => {
      const error = new AiProviderError('AUTHENTICATION', 'err');
      answerEvaluationService.evaluate.mockRejectedValue(error);

      await expect(service.evaluate(mockQuestion, mockStudentAnswer)).rejects.toThrow(error);
      expect(answerEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    });

    it('does not retry UNKNOWN error', async () => {
      const error = new AiProviderError('UNKNOWN', 'err');
      answerEvaluationService.evaluate.mockRejectedValue(error);

      await expect(service.evaluate(mockQuestion, mockStudentAnswer)).rejects.toThrow(error);
      expect(answerEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    });

    it('does not retry NotImplementedException', async () => {
      const error = new NotImplementedException('VOICE not supported');
      answerEvaluationService.evaluate.mockRejectedValue(error);

      await expect(service.evaluate(mockQuestion, mockStudentAnswer)).rejects.toThrow(error);
      expect(answerEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    });

    it('validation failure passes context to attempt 2', async () => {
      const validationError = new AnswerEvaluationValidationException({
        valid: false,
        errors: [{ code: 'EMPTY_FEEDBACK', message: 'err' }],
      });
      answerEvaluationService.evaluate
        .mockRejectedValueOnce(validationError)
        .mockResolvedValueOnce(mockResult);

      await service.evaluate(mockQuestion, mockStudentAnswer);
      
      expect(answerEvaluationService.evaluate).toHaveBeenCalledTimes(2);
      
      // Attempt 1: no context
      expect(answerEvaluationService.evaluate).toHaveBeenNthCalledWith(1, mockQuestion, mockStudentAnswer, undefined);
      
      // Attempt 2: with context
      expect(answerEvaluationService.evaluate).toHaveBeenNthCalledWith(2, mockQuestion, mockStudentAnswer, {
        validationErrors: [{ code: 'EMPTY_FEEDBACK', message: 'err' }],
      });
    });

    it('second validation failure replaces context', async () => {
      const error1 = new AnswerEvaluationValidationException({ valid: false, errors: [{ code: 'EMPTY_FEEDBACK', message: 'err1' }] });
      const error2 = new AnswerEvaluationValidationException({ valid: false, errors: [{ code: 'EMPTY_REASONING', message: 'err2' }] });
      
      answerEvaluationService.evaluate
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValueOnce(mockResult);

      await service.evaluate(mockQuestion, mockStudentAnswer);
      
      expect(answerEvaluationService.evaluate).toHaveBeenNthCalledWith(3, mockQuestion, mockStudentAnswer, {
        validationErrors: [{ code: 'EMPTY_REASONING', message: 'err2' }],
      });
    });

    it('provider error clears stale validation context', async () => {
      const error1 = new AnswerEvaluationValidationException({ valid: false, errors: [{ code: 'EMPTY_FEEDBACK', message: 'err1' }] });
      const error2 = new AiProviderError('RATE_LIMIT', 'rate limited');
      
      answerEvaluationService.evaluate
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValueOnce(mockResult);

      await service.evaluate(mockQuestion, mockStudentAnswer);
      
      // Attempt 2 got validation context
      expect(answerEvaluationService.evaluate).toHaveBeenNthCalledWith(2, mockQuestion, mockStudentAnswer, {
        validationErrors: [{ code: 'EMPTY_FEEDBACK', message: 'err1' }],
      });

      // Attempt 3 got no context because Attempt 2 was RATE_LIMIT
      expect(answerEvaluationService.evaluate).toHaveBeenNthCalledWith(3, mockQuestion, mockStudentAnswer, undefined);
    });
  });
});
