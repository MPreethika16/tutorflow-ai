import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MustChangePasswordGuard } from './must-change-password.guard';

describe('MustChangePasswordGuard', () => {
  let guard: MustChangePasswordGuard;
  let reflector: Reflector;
  let prisma: PrismaService;

  const mockPrisma = {
    student: {
      findUnique: jest.fn(),
    },
  };

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MustChangePasswordGuard,
        Reflector,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    guard = module.get<MustChangePasswordGuard>(MustChangePasswordGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('allows access when endpoint is exempt via metadata', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const context = createMockExecutionContext({
      sub: 'student-1',
      role: UserRole.STUDENT,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('allows access when request has no authenticated user', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockExecutionContext(undefined);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('allows access when user is a TEACHER', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context = createMockExecutionContext({
      sub: 'teacher-1',
      role: UserRole.TEACHER,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('allows access when STUDENT has mustChangePassword === false', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockPrisma.student.findUnique.mockResolvedValue({
      mustChangePassword: false,
    });
    const context = createMockExecutionContext({
      sub: 'student-1',
      role: UserRole.STUDENT,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockPrisma.student.findUnique).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      select: { mustChangePassword: true },
    });
  });

  it('throws ForbiddenException when STUDENT has mustChangePassword === true', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockPrisma.student.findUnique.mockResolvedValue({
      mustChangePassword: true,
    });
    const context = createMockExecutionContext({
      sub: 'student-1',
      role: UserRole.STUDENT,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Password change required before accessing this resource',
    );
    expect(mockPrisma.student.findUnique).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      select: { mustChangePassword: true },
    });
  });

  it('allows access if student record is not found (safe fallback)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockPrisma.student.findUnique.mockResolvedValue(null);
    const context = createMockExecutionContext({
      sub: 'student-without-profile',
      role: UserRole.STUDENT,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
