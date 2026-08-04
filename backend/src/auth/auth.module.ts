import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JwtModule,
  type JwtModuleOptions,
} from '@nestjs/jwt';
import type { StringValue } from 'ms';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],

      useFactory: (
        configService: ConfigService,
      ): JwtModuleOptions => {
        const secret =
          configService.get<string>('JWT_ACCESS_SECRET');

        if (!secret) {
          throw new Error(
            'JWT_ACCESS_SECRET is not configured',
          );
        }

          const expiresIn =
          configService.get<number>(
            'JWT_ACCESS_EXPIRES_IN_SECONDS',
            900,
          );

        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],

  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}