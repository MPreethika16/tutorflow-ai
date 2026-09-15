import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserRole } from '../../generated/prisma/client';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: {
    verifyAsync: jest.Mock;
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    };
    guard = new JwtAuthGuard(jwtService as unknown as JwtService);
  });

  const createMockContext = (headers: Record<string, string | undefined>): ExecutionContext => {
    const request = {
      headers,
      user: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('valid Bearer token authenticates successfully', async () => {
    const payload = { sub: 'user-1', role: UserRole.TEACHER, email: 't@example.com' };
    jwtService.verifyAsync.mockResolvedValue(payload);

    const context = createMockContext({
      authorization: 'Bearer valid-bearer-token',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-bearer-token');
    const req = context.switchToHttp().getRequest<{ user?: unknown }>();
    expect(req.user).toEqual(payload);
  });

  it('valid access_token cookie authenticates successfully', async () => {
    const payload = { sub: 'user-2', role: UserRole.STUDENT, email: null };
    jwtService.verifyAsync.mockResolvedValue(payload);

    const context = createMockContext({
      cookie: 'other_cookie=123; access_token=valid-cookie-token; session=abc',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-cookie-token');
    const req = context.switchToHttp().getRequest<{ user?: unknown }>();
    expect(req.user).toEqual(payload);
  });

  it('Bearer precedence when both Bearer and access_token cookie exist', async () => {
    const payload = { sub: 'user-1', role: UserRole.TEACHER, email: 't@example.com' };
    jwtService.verifyAsync.mockResolvedValue(payload);

    const context = createMockContext({
      authorization: 'Bearer bearer-token-takes-precedence',
      cookie: 'access_token=cookie-token-should-be-ignored',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('bearer-token-takes-precedence');
    expect(jwtService.verifyAsync).not.toHaveBeenCalledWith('cookie-token-should-be-ignored');
  });

  it('missing token throws UnauthorizedException', async () => {
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Access token is required'),
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('malformed/invalid token throws UnauthorizedException', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

    const context = createMockContext({
      authorization: 'Bearer malformed-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Access token is invalid or expired'),
    );
  });

  it('expired token behavior throws UnauthorizedException', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    const context = createMockContext({
      cookie: 'access_token=expired-token',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Access token is invalid or expired'),
    );
  });
});
