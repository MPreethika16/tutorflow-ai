import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../generated/prisma/client';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AssessmentsController', () => {
  let controller: AssessmentsController;
  let service: AssessmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentsController],
      providers: [
        {
          provide: AssessmentsService,
          useValue: {
            getAttemptForReview: jest.fn(),
            reviewAnswer: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AssessmentsController>(AssessmentsController);
    service = module.get<AssessmentsService>(AssessmentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('review endpoints', () => {
    it('GET calls getAttemptForReview', async () => {
      const mockResult = { attempt: { attemptId: 'ATT-1' } } as any;
      jest.spyOn(service, 'getAttemptForReview').mockResolvedValue(mockResult);

      const result = await controller.getAttemptForReview(
        { sub: 'teacher-1', role: UserRole.TEACHER } as any,
        'ASM-1',
        'ATT-1',
      );

      expect(service.getAttemptForReview).toHaveBeenCalledWith(
        'teacher-1',
        'ASM-1',
        'ATT-1',
      );
      expect(result).toBe(mockResult);
    });

    it('PATCH calls reviewAnswer', async () => {
      const mockResult = { finalMarks: 5 } as any;
      jest.spyOn(service, 'reviewAnswer').mockResolvedValue(mockResult);

      const result = await controller.reviewAnswer(
        { sub: 'teacher-1', role: UserRole.TEACHER } as any,
        'ASM-1',
        'ATT-1',
        'ANS-1',
        { teacherMarks: 5, teacherFeedback: 'Great' },
      );

      expect(service.reviewAnswer).toHaveBeenCalledWith(
        'teacher-1',
        'ASM-1',
        'ATT-1',
        'ANS-1',
        { teacherMarks: 5, teacherFeedback: 'Great' },
      );
      expect(result).toBe(mockResult);
    });
  });
});
