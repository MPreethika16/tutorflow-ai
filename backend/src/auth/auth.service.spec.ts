import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '../generated/prisma/client';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    $transaction: jest.Mock;
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    student: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return callback;
      }),
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      student: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked-jwt-token'),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'JWT_ACCESS_EXPIRES_IN_SECONDS') return 900;
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('teacher email login success', async () => {
    const mockUser = {
      id: 'teacher-uuid-1',
      email: 'teacher@example.com',
      firstName: 'Alice',
      lastName: 'Teacher',
      passwordHash: 'hashed-pwd',
      role: UserRole.TEACHER,
      status: UserStatus.ACTIVE,
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.update.mockResolvedValue({ ...mockUser, lastLoginAt: new Date() });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      identifier: 'teacher@example.com',
      password: 'validPassword123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'teacher@example.com' },
      select: expect.any(Object),
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: mockUser.id,
      role: mockUser.role,
      email: mockUser.email,
    });
    expect(result.accessToken).toBe('mocked-jwt-token');
    expect(result.expiresIn).toBe(900);
    expect(result.user.email).toBe('teacher@example.com');
  });

  it('returns configured expiresIn when JWT_ACCESS_EXPIRES_IN_SECONDS is custom', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'JWT_ACCESS_EXPIRES_IN_SECONDS') return '3600';
      return null;
    });

    const mockUser = {
      id: 'teacher-uuid-1',
      email: 'teacher@example.com',
      firstName: 'Alice',
      lastName: 'Teacher',
      passwordHash: 'hashed-pwd',
      role: UserRole.TEACHER,
      status: UserStatus.ACTIVE,
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.update.mockResolvedValue({ ...mockUser, lastLoginAt: new Date() });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      identifier: 'teacher@example.com',
      password: 'validPassword123',
    });

    expect(result.expiresIn).toBe(3600);
  });

  it('studentId login success', async () => {
    const mockStudentUser = {
      id: 'student-uuid-1',
      email: null,
      firstName: 'Bob',
      lastName: 'Student',
      passwordHash: 'hashed-pwd',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    };

    prisma.student.findUnique.mockResolvedValue({
      userId: 'student-uuid-1',
      studentId: 'STU-1234',
      user: mockStudentUser,
    });
    prisma.user.update.mockResolvedValue({ ...mockStudentUser, lastLoginAt: new Date() });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      identifier: 'STU-1234',
      password: 'validPassword123',
    });

    expect(prisma.student.findUnique).toHaveBeenCalledWith({
      where: { studentId: 'STU-1234' },
      include: expect.any(Object),
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: mockStudentUser.id,
      role: mockStudentUser.role,
      email: null,
    });
    expect(result.accessToken).toBe('mocked-jwt-token');
    expect(result.user.role).toBe(UserRole.STUDENT);
  });

  it('invalid identifier', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.student.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        identifier: 'nonexistent@example.com',
        password: 'anyPassword123',
      }),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.login({
        identifier: 'STU-UNKNOWN',
        password: 'anyPassword123',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('wrong password', async () => {
    const mockUser = {
      id: 'teacher-uuid-1',
      email: 'teacher@example.com',
      firstName: 'Alice',
      lastName: 'Teacher',
      passwordHash: 'hashed-pwd',
      role: UserRole.TEACHER,
      status: UserStatus.ACTIVE,
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        identifier: 'teacher@example.com',
        password: 'wrongPassword123',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('inactive user', async () => {
    const mockUser = {
      id: 'teacher-uuid-1',
      email: 'inactive@example.com',
      firstName: 'Alice',
      lastName: 'Teacher',
      passwordHash: 'hashed-pwd',
      role: UserRole.TEACHER,
      status: UserStatus.INACTIVE,
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);

    await expect(
      service.login({
        identifier: 'inactive@example.com',
        password: 'validPassword123',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid identifier or password'));

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('successful lastLoginAt update', async () => {
    const mockUser = {
      id: 'teacher-uuid-1',
      email: 'teacher@example.com',
      firstName: 'Alice',
      lastName: 'Teacher',
      passwordHash: 'hashed-pwd',
      role: UserRole.TEACHER,
      status: UserStatus.ACTIVE,
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.update.mockResolvedValue({ ...mockUser, lastLoginAt: new Date() });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await service.login({
      identifier: 'teacher@example.com',
      password: 'validPassword123',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUser.id },
      data: {
        lastLoginAt: expect.any(Date),
      },
    });
  });

  describe('changePassword', () => {
    it('correct current password succeeds and stores new hash', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        passwordHash: 'old-hash',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      // current password check -> true
      // same as current check -> false
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      const result = await service.changePassword('user-uuid-1', {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      });

      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully',
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword456', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { passwordHash: 'new-hash' },
      });
      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        data: { mustChangePassword: false },
      });
    });

    it('wrong current password rejected', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        passwordHash: 'old-hash',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-uuid-1', {
          currentPassword: 'wrongCurrentPassword',
          newPassword: 'newPassword456',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid current password'));

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('new password same as current password rejected', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        passwordHash: 'old-hash',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Identical strings in DTO
      await expect(
        service.changePassword('user-uuid-1', {
          currentPassword: 'samePassword123',
          newPassword: 'samePassword123',
        }),
      ).rejects.toThrow(new BadRequestException('New password cannot be the same as current password'));

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('teacher password change does not require Student record', async () => {
      const mockUser = {
        id: 'teacher-uuid-1',
        passwordHash: 'old-hash',
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-teacher-hash');

      const result = await service.changePassword('teacher-uuid-1', {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456',
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'teacher-uuid-1' },
        data: { passwordHash: 'new-teacher-hash' },
      });
      expect(prisma.student.update).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('returns mustChangePassword: true for student when required', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'student-1',
        firstName: 'Bob',
        lastName: 'Student',
        email: null,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        student: {
          mustChangePassword: true,
        },
      });

      const result = await service.getMe({
        sub: 'student-1',
        role: UserRole.STUDENT,
        email: null,
      });

      expect(result.sub).toBe('student-1');
      expect(result.mustChangePassword).toBe(true);
    });

    it('returns mustChangePassword: false for teacher', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'teacher-1',
        firstName: 'Alice',
        lastName: 'Teacher',
        email: 'alice@example.com',
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
        student: null,
      });

      const result = await service.getMe({
        sub: 'teacher-1',
        role: UserRole.TEACHER,
        email: 'alice@example.com',
      });

      expect(result.sub).toBe('teacher-1');
      expect(result.mustChangePassword).toBe(false);
    });
  });
});
