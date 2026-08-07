import { Test, TestingModule } from '@nestjs/testing';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { QuestionType } from '../generated/prisma/client';

import { QuestionsController } from './questions.controller';
import type { CreateQuestionDto } from './dto/create-question.dto';
import type { ReorderQuestionsDto } from './dto/reorder-questions.dto';
import type { UpdateQuestionDto } from './dto/update-question.dto';
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

  const user = {
    sub: 'teacher-user-id',
  } as JwtPayload;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        controllers: [QuestionsController],
        providers: [
          {
            provide: QuestionsService,
            useValue: questionsService,
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: jest.fn(() => true),
        })
        .overrideGuard(RolesGuard)
        .useValue({
          canActivate: jest.fn(() => true),
        })
        .compile();

    controller = module.get<QuestionsController>(
      QuestionsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates createQuestion to QuestionsService', async () => {
    const dto: CreateQuestionDto = {
      type: QuestionType.MCQ,
      prompt: 'What is the capital of India?',
      marks: 2,
      options: [
        { id: 'A', text: 'Delhi' },
        { id: 'B', text: 'Mumbai' },
        { id: 'C', text: 'Chennai' },
        { id: 'D', text: 'Kolkata' },
      ],
      correctOption: 'A',
    };

    const result = {
      question: {
        questionId: 'QUE-123',
      },
    };

    questionsService.createForTeacher.mockResolvedValue(result);

    await expect(
      controller.createQuestion(user, 'ASM-123', dto),
    ).resolves.toEqual(result);

    expect(
      questionsService.createForTeacher,
    ).toHaveBeenCalledWith(
      user.sub,
      'ASM-123',
      dto,
    );
  });

  it('delegates listQuestions to QuestionsService', async () => {
    const result = {
      questions: [],
    };

    questionsService.findAllForTeacher.mockResolvedValue(result);

    await expect(
      controller.listQuestions(user, 'ASM-123'),
    ).resolves.toEqual(result);

    expect(
      questionsService.findAllForTeacher,
    ).toHaveBeenCalledWith(
      user.sub,
      'ASM-123',
    );
  });

  it('delegates getQuestion to QuestionsService', async () => {
    const result = {
      question: {
        questionId: 'QUE-123',
      },
    };

    questionsService.findOneForTeacher.mockResolvedValue(result);

    await expect(
      controller.getQuestion(user, 'ASM-123', 'QUE-123'),
    ).resolves.toEqual(result);

    expect(
      questionsService.findOneForTeacher,
    ).toHaveBeenCalledWith(
      user.sub,
      'ASM-123',
      'QUE-123',
    );
  });

  it('delegates updateQuestion to QuestionsService', async () => {
    const dto: UpdateQuestionDto = {
      prompt: 'Updated question prompt',
    };

    const result = {
      question: {
        questionId: 'QUE-123',
        prompt: 'Updated question prompt',
      },
    };

    questionsService.updateForTeacher.mockResolvedValue(result);

    await expect(
      controller.updateQuestion(
        user,
        'ASM-123',
        'QUE-123',
        dto,
      ),
    ).resolves.toEqual(result);

    expect(
      questionsService.updateForTeacher,
    ).toHaveBeenCalledWith(
      user.sub,
      'ASM-123',
      'QUE-123',
      dto,
    );
  });

  it('delegates deleteQuestion to QuestionsService', async () => {
    const result = {
      message: 'Question deleted successfully',
    };

    questionsService.deleteForTeacher.mockResolvedValue(result);

    await expect(
      controller.deleteQuestion(
        user,
        'ASM-123',
        'QUE-123',
      ),
    ).resolves.toEqual(result);

    expect(
      questionsService.deleteForTeacher,
    ).toHaveBeenCalledWith(
      user.sub,
      'ASM-123',
      'QUE-123',
    );
  });

  it('delegates reorderQuestions to QuestionsService', async () => {
    const dto: ReorderQuestionsDto = {
      questions: [
        {
          questionId: 'QUE-123',
          order: 1,
        },
      ],
    };

    const result = {
      message: 'Questions reordered successfully',
      questions: [
        {
          questionId: 'QUE-123',
          order: 1,
        },
      ],
    };

    questionsService.reorderForTeacher.mockResolvedValue(result);

    await expect(
      controller.reorderQuestions(
        user,
        'ASM-123',
        dto,
      ),
    ).resolves.toEqual(result);

    expect(
      questionsService.reorderForTeacher,
    ).toHaveBeenCalledWith(
      user.sub,
      'ASM-123',
      dto,
    );
  });
});