import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../types/jwt-payload.type';

type AuthenticatedRequest = Request & {
  user?: JwtPayload;
};

export const CurrentUser = createParamDecorator(
  (
    _data: unknown,
    context: ExecutionContext,
  ): JwtPayload | undefined => {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.user;
  },
);