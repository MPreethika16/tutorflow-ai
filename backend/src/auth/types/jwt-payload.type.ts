import { UserRole } from '../../generated/prisma/client';

export type JwtPayload = {
  sub: string;
  role: UserRole;
  email: string | null;
};