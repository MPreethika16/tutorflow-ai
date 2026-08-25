import { Test, TestingModule } from '@nestjs/testing';
import { StudentAssessmentsController } from './student-assessments.controller';
import { StudentAssessmentsService } from './student-assessments.service';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { UserRole } from '../generated/prisma/client';

describe('StudentAssessmentsController', () => {
  let controller: StudentAssessmentsController;
  let service: StudentAssessmentsService;

  const mockService = {
    getAttemptHistoryForStudent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentAssessmentsController],
      providers: [
        {
          provide: StudentAssessmentsService,
          useValue: mockService,
        },
        {
          provide: JwtService,
          useValue: {},
        }
      ],
    }).compile();

    controller = module.get<StudentAssessmentsController>(StudentAssessmentsController);
    service = module.get<StudentAssessmentsService>(StudentAssessmentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAttemptHistory', () => {
    it('calls getAttemptHistoryForStudent with correct userId', async () => {
      const user: JwtPayload = { sub: 'student-id', email: 'stu@test.com', role: UserRole.STUDENT };
      mockService.getAttemptHistoryForStudent.mockResolvedValue({ attempts: [] });

      const result = await controller.getAttemptHistory(user);

      expect(service.getAttemptHistoryForStudent).toHaveBeenCalledWith('student-id');
      expect(result).toEqual({ attempts: [] });
    });
  });
});
