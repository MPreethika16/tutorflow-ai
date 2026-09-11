import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from '../types/jwt-payload.type';

type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    try {
      request.user =
        await this.jwtService.verifyAsync<JwtPayload>(token);

      return true;
    } catch {
      throw new UnauthorizedException(
        'Access token is invalid or expired',
      );
    }
  }

  private extractToken(request: Request): string | undefined {
    // 1. Authorization: Bearer <token> (precedence 1)
    const authorization = request.headers.authorization;
    if (authorization) {
      const [type, token] = authorization.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    // 2. access_token cookie (precedence 2)
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const token = this.extractCookie(cookieHeader, 'access_token');
      if (token) {
        return token;
      }
    }

    return undefined;
  }

  private extractCookie(cookieHeader: string, name: string): string | undefined {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const rawKey = trimmed.slice(0, eqIdx).trim();
      if (rawKey === name) {
        const rawValue = trimmed.slice(eqIdx + 1).trim();
        if (!rawValue) return undefined;
        try {
          return decodeURIComponent(rawValue);
        } catch {
          return rawValue;
        }
      }
    }
    return undefined;
  }
}