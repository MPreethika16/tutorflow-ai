import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import {
  UserRole,
  UserStatus,
} from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function seedTestTeacher(
  app: INestApplication,
) {
  const prisma = app.get(PrismaService);

  const email =
    process.env.TEST_TEACHER_EMAIL!
      .trim()
      .toLowerCase();

  const password =
    process.env.TEST_TEACHER_PASSWORD!;

  if (!email || !password) {
    throw new Error(
      'TEST_TEACHER_EMAIL and TEST_TEACHER_PASSWORD must be configured',
    );
  }

  // Use exactly the same hashing cost as UsersService.
  const passwordHash = await bcrypt.hash(
    password,
    12,
  );

  // Upsert makes the seed reusable.
  //
  // First run:
  //   creates the test teacher.
  //
  // Later runs:
  //   resets password/status so login remains predictable.
  const user = await prisma.user.upsert({
    where: {
      email,
    },

    update: {
      firstName: 'E2E',
      lastName: 'Teacher',
      passwordHash,
      role: UserRole.TEACHER,
      status: UserStatus.ACTIVE,
    },

    create: {
      firstName: 'E2E',
      lastName: 'Teacher',
      email,
      passwordHash,
      role: UserRole.TEACHER,
      status: UserStatus.ACTIVE,

      teacher: {
        create: {
          phoneNumber: null,
        },
      },
    },

    select: {
      id: true,
      email: true,
      role: true,
      status: true,
    },
  });

  return user;
}