import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AnswerEvaluationWorkerService } from './answer-evaluation-worker.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EvaluationStatus } from '../../generated/prisma/client';
import { AnswerEvaluationPersistenceService } from './answer-evaluation-persistence.service';

describe('AnswerEvaluationWorkerService', () => {
  let service: AnswerEvaluationWorkerService;
  let prismaMock: Record<string, any>;
  let persistenceMock: Record<string, any>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([
        { id: '1', studentAnswerId: 'ans-1' },
        { id: '2', studentAnswerId: 'ans-2' },
      ]),
      studentAnswer: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'ans-1') return Promise.resolve({ id: 'ans-1', question: { id: 'q-1' } });
          if (where.id === 'ans-2') return Promise.resolve({ id: 'ans-2', question: { id: 'q-2' } });
          return Promise.resolve(null);
        }),
      },
      answerEvaluation: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    persistenceMock = {
      evaluateAndPersist: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnswerEvaluationWorkerService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: AnswerEvaluationPersistenceService,
          useValue: persistenceMock,
        },
      ],
    }).compile();

    service = module.get<AnswerEvaluationWorkerService>(AnswerEvaluationWorkerService);
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('claims only PENDING rows up to batch size and logs them, then calls persistence', async () => {
    loggerSpy.mockClear();
    await service.pollPendingEvaluations();

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    
    // Check that it calls persistence for each claimed ID
    expect(prismaMock.studentAnswer.findUnique).toHaveBeenCalledTimes(2);
    expect(persistenceMock.evaluateAndPersist).toHaveBeenCalledTimes(2);
    
    expect(loggerSpy).toHaveBeenCalledWith('Claimed 2 PENDING answer evaluation(s). IDs: 1, 2');
  });

  it('marks FAILED if evaluateAndPersist throws, and continues processing', async () => {
    loggerSpy.mockClear();
    
    persistenceMock.evaluateAndPersist.mockRejectedValueOnce(new Error('Evaluation failed'))
                                      .mockResolvedValueOnce({});
    
    await service.pollPendingEvaluations();

    expect(persistenceMock.evaluateAndPersist).toHaveBeenCalledTimes(2);
    expect(prismaMock.answerEvaluation.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.answerEvaluation.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: EvaluationStatus.FAILED },
    });
  });

  it('marks FAILED if StudentAnswer or Question is not found', async () => {
    loggerSpy.mockClear();
    prismaMock.studentAnswer.findUnique.mockResolvedValueOnce(null);

    await service.pollPendingEvaluations();

    // First one fails before calling evaluateAndPersist
    expect(persistenceMock.evaluateAndPersist).toHaveBeenCalledTimes(1);
    expect(prismaMock.answerEvaluation.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.answerEvaluation.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: EvaluationStatus.FAILED },
    });
  });

  it('does not log if no PENDING evaluations are claimed', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    loggerSpy.mockClear();

    await service.pollPendingEvaluations();

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it('only queries the database via $queryRaw if empty array returned', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]);
    await service.pollPendingEvaluations();
    
    // Check that it didn't do further queries
    expect(prismaMock.studentAnswer.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.answerEvaluation.update).not.toHaveBeenCalled();
  });
});
