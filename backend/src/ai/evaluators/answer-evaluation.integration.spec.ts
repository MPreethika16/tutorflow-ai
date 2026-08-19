import { Test, TestingModule } from '@nestjs/testing';
import { AnswerEvaluationPersistenceService } from './answer-evaluation-persistence.service';
import { AnswerEvaluationService, AnswerEvaluationValidationException } from './answer-evaluation.service';
import { EvaluationLoopService } from './answer-evaluation-loop.service';
import { McqEvaluatorService } from './mcq-evaluator.service';
import { TypedEvaluatorService } from './typed-evaluator.service';
import { AiService } from '../ai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Question, StudentAnswer, QuestionType, EvaluationStatus, AnswerEvaluation } from '../../generated/prisma/client';
import { NotImplementedException, InternalServerErrorException } from '@nestjs/common';

describe('Answer Evaluation Integration', () => {
  let persistenceService: AnswerEvaluationPersistenceService;
  let aiService: AiService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerEvaluationPersistenceService,
        EvaluationLoopService,
        AnswerEvaluationService,
        McqEvaluatorService,
        TypedEvaluatorService,
        {
          provide: AiService,
          useValue: {
            generateStructured: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            answerEvaluation: {
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    persistenceService = module.get<AnswerEvaluationPersistenceService>(AnswerEvaluationPersistenceService);
    aiService = module.get<AiService>(AiService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const baseQuestion: Question = {
    id: 'q1',
    questionId: 'qid',
    assessmentId: 'a1',
    type: QuestionType.MCQ,
    prompt: 'Question?',
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
    id: 'ans1',
    attemptId: 'att1',
    questionId: 'q1',
    selectedOption: null,
    textAnswer: null,
    voiceUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. MCQ correct: full marks, confidence 1, persisted, WAITING_FOR_REVIEW', async () => {
    const question = { ...baseQuestion, type: QuestionType.MCQ, correctOption: 'A' };
    const answer = { ...baseAnswer, selectedOption: 'A' };

    const mockPersisted = { id: 'eval1', status: EvaluationStatus.WAITING_FOR_REVIEW } as AnswerEvaluation;
    jest.spyOn(prisma.answerEvaluation, 'upsert').mockResolvedValue(mockPersisted);

    const result = await persistenceService.evaluateAndPersist(question, answer);
    expect(result.status).toBe(EvaluationStatus.WAITING_FOR_REVIEW);

    expect(prisma.answerEvaluation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          aiMarks: 10,
          aiConfidence: 1,
          status: EvaluationStatus.WAITING_FOR_REVIEW,
        }),
      })
    );
  });

  it('2. MCQ incorrect: zero marks, persisted', async () => {
    const question = { ...baseQuestion, type: QuestionType.MCQ, correctOption: 'A' };
    const answer = { ...baseAnswer, selectedOption: 'B' };

    jest.spyOn(prisma.answerEvaluation, 'upsert').mockResolvedValue({} as any);

    await persistenceService.evaluateAndPersist(question, answer);

    expect(prisma.answerEvaluation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          aiMarks: 0,
        }),
      })
    );
  });

  it('3. TYPED valid: mock AiService, validated, persisted', async () => {
    const question = { ...baseQuestion, type: QuestionType.TYPED };
    const answer = { ...baseAnswer, textAnswer: 'My typed answer' };

    jest.spyOn(aiService, 'generateStructured').mockResolvedValue({
      suggestedMarks: 8,
      feedback: 'Good',
      reasoning: 'Because it is good',
      confidence: 0.9,
    });

    jest.spyOn(prisma.answerEvaluation, 'upsert').mockResolvedValue({} as any);

    await persistenceService.evaluateAndPersist(question, answer);

    expect(aiService.generateStructured).toHaveBeenCalled();
    expect(prisma.answerEvaluation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          aiMarks: 8,
          aiFeedback: 'Good',
        }),
      })
    );
  });

  it('4. TYPED empty: no AI call, zero marks, persisted', async () => {
    const question = { ...baseQuestion, type: QuestionType.TYPED };
    const answer = { ...baseAnswer, textAnswer: '   ' };

    jest.spyOn(prisma.answerEvaluation, 'upsert').mockResolvedValue({} as any);

    await persistenceService.evaluateAndPersist(question, answer);

    expect(aiService.generateStructured).not.toHaveBeenCalled();
    expect(prisma.answerEvaluation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          aiMarks: 0,
          aiFeedback: 'No answer was provided.',
        }),
      })
    );
  });

  it('5. TYPED over-scoring: validation fails, nothing persisted', async () => {
    const question = { ...baseQuestion, type: QuestionType.TYPED, marks: 5 };
    const answer = { ...baseAnswer, textAnswer: 'My typed answer' };

    // AI suggests 10 for a 5 mark question
    jest.spyOn(aiService, 'generateStructured').mockResolvedValue({
      suggestedMarks: 10,
      feedback: 'Excellent',
      reasoning: 'Because it is perfect',
      confidence: 0.9,
    });

    await expect(persistenceService.evaluateAndPersist(question, answer))
      .rejects.toThrow(InternalServerErrorException);

    expect(prisma.answerEvaluation.upsert).not.toHaveBeenCalled();
  });

  it('6. AI/provider failure: nothing persisted', async () => {
    const question = { ...baseQuestion, type: QuestionType.TYPED };
    const answer = { ...baseAnswer, textAnswer: 'My typed answer' };

    jest.spyOn(aiService, 'generateStructured').mockRejectedValue(new Error('AI failed'));

    await expect(persistenceService.evaluateAndPersist(question, answer))
      .rejects.toThrow('AI failed');

    expect(prisma.answerEvaluation.upsert).not.toHaveBeenCalled();
  });

  it('7. VOICE: unsupported, nothing persisted', async () => {
    const question = { ...baseQuestion, type: QuestionType.VOICE };
    const answer = { ...baseAnswer };

    await expect(persistenceService.evaluateAndPersist(question, answer))
      .rejects.toThrow(NotImplementedException);

    expect(prisma.answerEvaluation.upsert).not.toHaveBeenCalled();
  });

  it('8. Existing AnswerEvaluation: AI fields update, teacher fields preserved', async () => {
    const question = { ...baseQuestion, type: QuestionType.MCQ, correctOption: 'A' };
    const answer = { ...baseAnswer, selectedOption: 'A' };

    jest.spyOn(prisma.answerEvaluation, 'upsert').mockResolvedValue({} as any);

    await persistenceService.evaluateAndPersist(question, answer);

    const upsertArgs = (prisma.answerEvaluation.upsert as jest.Mock).mock.calls[0][0];

    expect(upsertArgs.update).toHaveProperty('aiMarks', 10);
    expect(upsertArgs.update).not.toHaveProperty('teacherMarks');
    expect(upsertArgs.update).not.toHaveProperty('teacherFeedback');
  });
});
