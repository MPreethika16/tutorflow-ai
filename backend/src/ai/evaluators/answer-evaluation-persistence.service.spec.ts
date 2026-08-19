import { Test, TestingModule } from '@nestjs/testing';
import { AnswerEvaluationPersistenceService } from './answer-evaluation-persistence.service';
import { AnswerEvaluationService, AnswerEvaluationValidationException } from './answer-evaluation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Question, StudentAnswer, QuestionType, EvaluationStatus, AnswerEvaluation } from '../../generated/prisma/client';

describe('AnswerEvaluationPersistenceService', () => {
  let service: AnswerEvaluationPersistenceService;
  let orchestrator: AnswerEvaluationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerEvaluationPersistenceService,
        {
          provide: AnswerEvaluationService,
          useValue: {
            evaluate: jest.fn(),
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

    service = module.get<AnswerEvaluationPersistenceService>(AnswerEvaluationPersistenceService);
    orchestrator = module.get<AnswerEvaluationService>(AnswerEvaluationService);
    prisma = module.get<PrismaService>(PrismaService);
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
    id: 'ans_uuid_1',
    attemptId: 'att1',
    questionId: 'q1',
    selectedOption: null,
    textAnswer: null,
    voiceUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakeEvaluationResult = {
    suggestedMarks: 8,
    feedback: 'Good',
    reasoning: 'Reason',
    confidence: 0.9,
  };

  it('valid MCQ evaluation is persisted with WAITING_FOR_REVIEW', async () => {
    jest.spyOn(orchestrator, 'evaluate').mockResolvedValue(fakeEvaluationResult);
    const mockPersisted = { id: 'eval1', status: EvaluationStatus.WAITING_FOR_REVIEW } as AnswerEvaluation;
    jest.spyOn(prisma.answerEvaluation, 'upsert').mockResolvedValue(mockPersisted);

    const result = await service.evaluateAndPersist(baseQuestion, baseAnswer);
    
    expect(result).toEqual(mockPersisted);
    expect(prisma.answerEvaluation.upsert).toHaveBeenCalledWith({
      where: { studentAnswerId: 'ans_uuid_1' },
      create: expect.objectContaining({
        studentAnswerId: 'ans_uuid_1',
        aiMarks: 8,
        aiFeedback: 'Good',
        aiReasoning: 'Reason',
        aiConfidence: 0.9,
        status: EvaluationStatus.WAITING_FOR_REVIEW,
      }),
      update: expect.objectContaining({
        aiMarks: 8,
        aiFeedback: 'Good',
        aiReasoning: 'Reason',
        aiConfidence: 0.9,
        status: EvaluationStatus.WAITING_FOR_REVIEW,
      }),
    });
  });

  it('valid TYPED evaluation is persisted', async () => {
    jest.spyOn(orchestrator, 'evaluate').mockResolvedValue(fakeEvaluationResult);
    jest.spyOn(prisma.answerEvaluation, 'upsert').mockResolvedValue({} as any);

    await service.evaluateAndPersist({ ...baseQuestion, type: QuestionType.TYPED }, baseAnswer);
    
    expect(prisma.answerEvaluation.upsert).toHaveBeenCalledTimes(1);
  });

  it('evaluation failure causes no persistence', async () => {
    jest.spyOn(orchestrator, 'evaluate').mockRejectedValue(new Error('AI failed'));

    await expect(service.evaluateAndPersist(baseQuestion, baseAnswer)).rejects.toThrow('AI failed');
    expect(prisma.answerEvaluation.upsert).not.toHaveBeenCalled();
  });

  it('validation failure causes no persistence', async () => {
    jest.spyOn(orchestrator, 'evaluate').mockRejectedValue(new AnswerEvaluationValidationException({ valid: false, errors: [] }));

    await expect(service.evaluateAndPersist(baseQuestion, baseAnswer)).rejects.toThrow(AnswerEvaluationValidationException);
    expect(prisma.answerEvaluation.upsert).not.toHaveBeenCalled();
  });

  it('existing evaluation is updated rather than duplicated and preserves teacher fields', async () => {
    jest.spyOn(orchestrator, 'evaluate').mockResolvedValue(fakeEvaluationResult);
    jest.spyOn(prisma.answerEvaluation, 'upsert').mockResolvedValue({} as any);

    await service.evaluateAndPersist(baseQuestion, baseAnswer);

    const upsertCall = (prisma.answerEvaluation.upsert as jest.Mock).mock.calls[0][0];
    
    // Validate update doesn't touch teacherMarks or teacherFeedback
    expect(upsertCall.update).not.toHaveProperty('teacherMarks');
    expect(upsertCall.update).not.toHaveProperty('teacherFeedback');
  });
});
