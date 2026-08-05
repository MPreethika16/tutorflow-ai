import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  Prisma,
  UserRole,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UserStatus } from '../generated/prisma/client';

import {
  generateTemporaryPassword,
  hashPassword,
} from '../common/utils/password.util';
@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    teacherUserId: string,
    dto: CreateStudentDto,
  ) {
    const teacher = await this.prisma.teacher.findUnique({
      where: {
        userId: teacherUserId,
      },
      select: {
        userId: true,
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher profile was not found');
    }

    const studentId = await this.generateUniqueStudentId();
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    try {
      const studentUser = await this.prisma.user.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          email: null,
          passwordHash,
          role: UserRole.STUDENT,
          student: {
            create: {
              teacherId: teacherUserId,
              studentId,
              board: dto.board.trim(),
              grade: dto.grade.trim(),
              rollNumber: dto.rollNumber?.trim() || null,
              parentName: dto.parentName?.trim() || null,
              mustChangePassword: true,
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
          student: {
            select: {
              studentId: true,
              board: true,
              grade: true,
              rollNumber: true,
              parentName: true,
              mustChangePassword: true,
            },
          },
        },
      });

      return {
        student: studentUser,
        credentials: {
          studentId,
          temporaryPassword,
        },
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A student with the generated identifier already exists',
        );
      }

      throw new InternalServerErrorException(
        'Unable to create student account',
      );
    }
  }

  async findOneForTeacher(
  teacherUserId: string,
  studentUserId: string,
) {
  const student = await this.prisma.student.findFirst({
    where: {
      userId: studentUserId,
      teacherId: teacherUserId,
    },
    select: {
      userId: true,
      studentId: true,
      board: true,
      grade: true,
      rollNumber: true,
      parentName: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          status: true,
          lastLoginAt: true,
        },
      },
    },
  });

  if (!student) {
    throw new NotFoundException('Student not found');
  }

  return student;
}
  async findAllForTeacher(teacherUserId: string) {
  return this.prisma.student.findMany({
    where: {
      teacherId: teacherUserId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      userId: true,
      studentId: true,
      board: true,
      grade: true,
      rollNumber: true,
      parentName: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          status: true,
        },
      },
    },
  });
}
  async updateForTeacher(
  teacherUserId: string,
  studentId: string,
  dto: UpdateStudentDto,
) {
  // Step 1:
  // Check whether this student belongs to the logged-in teacher.
  //
  // We search using BOTH:
  // - public student ID from the route
  // - teacher ID from the JWT
  //
  // This prevents one teacher from updating another teacher's student.
  const ownedStudent = await this.prisma.student.findFirst({
    where: {
      studentId,
      teacherId: teacherUserId,
    },
    select: {
      userId: true,
    },
  });

  // We return 404 for both cases:
  // - the student does not exist
  // - the student belongs to another teacher
  //
  // This avoids revealing information about another teacher's students.
  if (!ownedStudent) {
    throw new NotFoundException('Student not found');
  }

  // Step 2:
  // Update the Student record and its related User record together.
  //
  // Student fields:
  // - board
  // - grade
  // - rollNumber
  // - parentName
  //
  // User fields:
  // - firstName
  // - lastName
  //
  // Prisma treats `undefined` as:
  // "Do not update this field."
  //
  // For nullable values such as rollNumber and parentName:
  // - field missing => undefined => keep old value
  // - empty string => null => remove old value
  const updatedStudent = await this.prisma.student.update({
    where: {
      // studentId is unique in the Prisma schema,
      // so it can be used in an update query.
      studentId,
    },
    data: {
      board:
        dto.board === undefined
          ? undefined
          : dto.board.trim(),

      grade:
        dto.grade === undefined
          ? undefined
          : dto.grade.trim(),

      rollNumber:
        dto.rollNumber === undefined
          ? undefined
          : dto.rollNumber.trim() || null,

      parentName:
        dto.parentName === undefined
          ? undefined
          : dto.parentName.trim() || null,

      // Nested update:
      // Student has a one-to-one relationship with User.
      // This lets us update names without making a separate user.update call.
      user: {
        update: {
          firstName:
            dto.firstName === undefined
              ? undefined
              : dto.firstName.trim(),

          lastName:
            dto.lastName === undefined
              ? undefined
              : dto.lastName.trim(),
        },
      },
    },

    // Step 3:
    // Return only fields that are safe and useful to the frontend.
    //
    // We do not return passwordHash or other authentication data.
    select: {
      userId: true,
      studentId: true,
      board: true,
      grade: true,
      rollNumber: true,
      parentName: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          status: true,
        },
      },
    },
  });

  return updatedStudent;
}async resetPasswordForTeacher(
  teacherUserId: string,
  studentId: string,
) {
  // Step 1:
  // Find the student using:
  // - the public student ID from the route
  // - the logged-in teacher ID from the JWT
  //
  // This is the ownership check.
  // It prevents one teacher from resetting another teacher's student password.
  const student = await this.prisma.student.findFirst({
    where: {
      studentId,
      teacherId: teacherUserId,
    },
    select: {
      studentId: true,
      user: {
        select: {
          status: true,
        },
      },
    },
  });

  // Step 2:
  // If no matching student is found, return 404.
  //
  // This covers both cases:
  // - the student does not exist
  // - the student belongs to another teacher
  //
  // We do not reveal which one happened.
  if (!student) {
    throw new NotFoundException('Student not found');
  }

  // Step 3:
  // Password reset is allowed only for ACTIVE students.
  //
  // If the student is inactive or suspended,
  // the teacher must reactivate the account first.
  if (student.user.status !== UserStatus.ACTIVE) {
    throw new ConflictException(
      'Reactivate the student before resetting the password',
    );
  }

  // Step 4:
  // Generate a brand-new temporary password.
  //
  // The teacher does not choose this password.
  // Every reset creates a different temporary password.
  const temporaryPassword = generateTemporaryPassword();

  // Step 5:
  // Hash the temporary password before saving it.
  //
  // The plain password is never stored in PostgreSQL.
  const passwordHash = await hashPassword(temporaryPassword);

  // Step 6:
  // Update both related records in one nested Prisma update.
  //
  // Student table:
  // mustChangePassword becomes true
  //
  // User table:
  // passwordHash is replaced with the new hash
  //
  // The old password stops working immediately.
  await this.prisma.student.update({
    where: {
      studentId,
    },
    data: {
      mustChangePassword: true,
      user: {
        update: {
          passwordHash,
        },
      },
    },
  });

  // Step 7:
  // Return the plain temporary password only once.
  //
  // It is returned in this response so the teacher can share it.
  // It cannot be retrieved later because only the hash is stored.
  return {
    studentId,
    temporaryPassword,
    mustChangePassword: true,
  };
}




  private async generateUniqueStudentId(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = randomBytes(4)
        .toString('hex')
        .toUpperCase();

      const studentId = `STU-${suffix}`;

      const existingStudent =
        await this.prisma.student.findUnique({
          where: {
            studentId,
          },
          select: {
            userId: true,
          },
        });

      if (!existingStudent) {
        return studentId;
      }
    }

    throw new InternalServerErrorException(
      'Unable to generate a unique student ID',
    );
  }

  private generateTemporaryPassword(): string {
    return `${randomBytes(6).toString('base64url')}#7a`;
  }
}