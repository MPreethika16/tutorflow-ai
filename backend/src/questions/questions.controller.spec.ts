import { Test, TestingModule } from '@nestjs/testing';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

describe('QuestionsController', () => {
  let controller: QuestionsController;

  const questionsService = {
    createForTeacher: jest.fn(),
    findAllForTeacher: jest.fn(),
    findOneForTeacher: jest.fn(),
    updateForTeacher: jest.fn(),
    deleteForTeacher: jest.fn(),
    reorderForTeacher: jest.fn(),
  };

  const user = { sub: 'teacher-user-id' } as JwtPayload;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionsController],
      providers: [
        {
          provide: QuestionsService,
          useValue: questionsService,
        },
      ],
    }).compile();

    controller = module.get<QuestionsController>(QuestionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates listQuestions to QuestionsService', async () => {
    const result = { questions: [] };
    questionsService.findAllForTeacher.mockResolvedValue(result);

    await expect(
      controller.listQuestions(user, 'ASM-123'),
    ).resolves.toEqual(result);

    expect(questionsService.findAllForTeacher).toHaveBeenCalledWith(
      user.sub,
      'ASM-123',
    );
  });

  it('delegates getQuestion to QuestionsService', async () => {
    const result = { question: { questionId: 'QUE-123' } };
    questionsService.findOneForTeacher.mockResolvedValue(result);

    await expect(
      controller.getQuestion(user, 'ASM-123', 'QUE-123'),
    ).resolves.toEqual(result);

    expect(questionsService.findOneForTeacher).toHaveBeenCalledWith(
      user.sub,
      'ASM-123',
      'QUE-123',
    );
  });

  it('delegates deleteQuestion to QuestionsService', async () => {
    const result = { message: 'Question deleted successfully' };
    questionsService.deleteForTeacher.mockResolvedValue(result);

    await expect(
      controller.deleteQuestion(user, 'ASM-123', 'QUE-123'),
    ).resolves.toEqual(result);

    expect(questionsService.deleteForTeacher).toHaveBeenCalledWith(
      user.sub,
      'ASM-123',
      'QUE-123',
    );
  });
});
