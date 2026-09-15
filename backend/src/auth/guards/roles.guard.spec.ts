import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../generated/prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: {
    getAllAndOverride: jest.Mock;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  const createMockContext = (user?: { role: UserRole }): ExecutionContext => {
    const request = {
      user,
    };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('route without role metadata allows access', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createMockContext();
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('allowed role permits access', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.TEACHER]);

    const context = createMockContext({ role: UserRole.TEACHER });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('rejected role throws ForbiddenException', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.TEACHER]);

    const context = createMockContext({ role: UserRole.STUDENT });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('missing authenticated user throws ForbiddenException', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.TEACHER]);

    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
