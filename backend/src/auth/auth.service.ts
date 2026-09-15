import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { resolveJwtExpiresInSeconds } from './utils/jwt-config.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  getAccessTokenExpiresInSeconds(): number {
    return resolveJwtExpiresInSeconds(this.configService);
  }

  async login(dto: LoginDto) {
    const rawIdentifier = (dto.identifier ?? dto.email)?.trim();

    if (!rawIdentifier) {
      throw new UnauthorizedException('Invalid identifier or password');
    }

    let user: {
      id: string;
      email: string | null;
      firstName: string;
      lastName: string;
      passwordHash: string;
      role: UserRole;
      status: UserStatus;
    } | null = null;

    let studentMustChangePassword = false;

    if (rawIdentifier.includes('@')) {
      const normalizedEmail = rawIdentifier.toLowerCase();
      user = await this.prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          passwordHash: true,
          role: true,
          status: true,
        },
      });
    } else {
      let student = await this.prisma.student.findUnique({
        where: {
          studentId: rawIdentifier,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              passwordHash: true,
              role: true,
              status: true,
            },
          },
        },
      });

      if (!student && rawIdentifier !== rawIdentifier.toUpperCase()) {
        student = await this.prisma.student.findUnique({
          where: {
            studentId: rawIdentifier.toUpperCase(),
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                passwordHash: true,
                role: true,
                status: true,
              },
            },
          },
        });
      }

      if (student) {
        studentMustChangePassword = student.mustChangePassword;
      }

      user = student?.user ?? null;
    }

    if (!user) {
      throw new UnauthorizedException('Invalid identifier or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid identifier or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid identifier or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const mustChangePassword =
      user.role === UserRole.STUDENT ? studentMustChangePassword : false;

    const expiresIn = this.getAccessTokenExpiresInSeconds();

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        mustChangePassword,
      },
    };
  }

  async getMe(userPayload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: userPayload.sub },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        student: {
          select: {
            mustChangePassword: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      sub: user.id,
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      mustChangePassword:
        user.role === UserRole.STUDENT
          ? (user.student?.mustChangePassword ?? false)
          : false,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        role: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid user or inactive account');
    }

    const currentMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!currentMatches) {
      throw new UnauthorizedException('Invalid current password');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password cannot be the same as current password');
    }

    const isSameAsCurrent = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );

    if (isSameAsCurrent) {
      throw new BadRequestException('New password cannot be the same as current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
        },
      });

      if (user.role === UserRole.STUDENT) {
        await tx.student.update({
          where: { userId: user.id },
          data: {
            mustChangePassword: false,
          },
        });
      }
    });

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }
}