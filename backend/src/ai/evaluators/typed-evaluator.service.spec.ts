import { Test, TestingModule } from '@nestjs/testing';
import { TypedEvaluatorService } from './typed-evaluator.service';
import { AiService } from '../ai.service';
import { Question, StudentAnswer, QuestionType } from '../../generated/prisma/client';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { buildTypedEvaluationMessages } from '../prompts/typed-evaluation.prompt';

describe('TypedEvaluatorService', () => {
  let service: TypedEvaluatorService;
  let aiService: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypedEvaluatorService,
        {
          provide: AiService,
          useValue: {
            generateStructured: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TypedEvaluatorService>(TypedEvaluatorService);
    aiService = module.get<AiService>(AiService);
  });

  const baseQuestion: Question = {
    id: 'q1',
    questionId: 'qid',
    assessmentId: 'a1',
    type: QuestionType.TYPED,
    prompt: 'Describe photosynthesis.',
    marks: 10,
    order: 1,
    options: null,
    correctOption: null,
    explanation: null,
    modelAnswer: 'It converts light energy into chemical energy.',
    gradingInstructions: 'Give 10 marks if they mention light and chemical energy.',
    createdAt: new Date(),
    updatedAt: new Date(),
    embedding: null as any,
  };

  const baseAnswer: StudentAnswer = {
    id: 'a1',
    attemptId: 'att1',
    questionId: 'q1',
    selectedOption: null,
    textAnswer: 'Plants use sunlight to make food.',
    voiceUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('non-TYPED question is rejected', async () => {
    await expect(
      service.evaluate({ ...baseQuestion, type: QuestionType.MCQ }, baseAnswer),
    ).rejects.toThrow(BadRequestException);
  });

  it('empty answer returns deterministic 0 and does not call AI', async () => {
    const result = await service.evaluate(baseQuestion, { ...baseAnswer, textAnswer: '   ' });
    expect(result.suggestedMarks).toBe(0);
    expect(result.feedback).toBe('No answer was provided.');
    expect(aiService.generateStructured).not.toHaveBeenCalled();
  });

  it('valid typed answer calls generateStructured once with correct prompt', async () => {
    jest.spyOn(aiService, 'generateStructured').mockResolvedValue({
      suggestedMarks: 8,
      feedback: 'Good.',
      reasoning: 'Mentioned light but not chemical energy explicitly.',
      confidence: 0.9,
    });

    const result = await service.evaluate(baseQuestion, baseAnswer);
    expect(result.suggestedMarks).toBe(8);
    expect(aiService.generateStructured).toHaveBeenCalledTimes(1);

    const callArgs = (aiService.generateStructured as jest.Mock).mock.calls[0];
    const messages = callArgs[0].messages;

    expect(messages[1].content).toContain(baseQuestion.prompt);
    expect(messages[1].content).toContain(baseQuestion.modelAnswer);
    expect(messages[1].content).toContain(baseQuestion.gradingInstructions);
    expect(messages[1].content).toContain(baseQuestion.marks.toString());
    expect(messages[1].content).toContain(baseAnswer.textAnswer);
  });

  it('suggestedMarks above maximum is rejected, not clamped', async () => {
    jest.spyOn(aiService, 'generateStructured').mockResolvedValue({
      suggestedMarks: 15,
      feedback: 'Excellent.',
      reasoning: 'Perfect.',
      confidence: 1.0,
    });

    await expect(service.evaluate(baseQuestion, baseAnswer)).rejects.toThrow(InternalServerErrorException);
  });

  it('AI/provider error propagates', async () => {
    jest.spyOn(aiService, 'generateStructured').mockRejectedValue(new Error('Provider fail'));
    await expect(service.evaluate(baseQuestion, baseAnswer)).rejects.toThrow('Provider fail');
  });

  describe('prompt builder', () => {
    it('constructs correct messages', () => {
      const messages = buildTypedEvaluationMessages({
        prompt: 'A',
        modelAnswer: 'B',
        gradingInstructions: 'C',
        marks: 5,
        studentAnswer: 'D',
      });
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toContain('A');
      expect(messages[1].content).toContain('B');
      expect(messages[1].content).toContain('C');
      expect(messages[1].content).toContain('5');
      expect(messages[1].content).toContain('D');
    });
  });
});
