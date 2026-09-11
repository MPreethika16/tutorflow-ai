import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JwtModule,
  type JwtModuleOptions,
} from '@nestjs/jwt';

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
          configService.get<string>(
            'JWT_ACCESS_SECRET',
          );

        if (!secret) {
          throw new Error(
            'JWT_ACCESS_SECRET is not configured',
          );
        }

        const rawExpiresIn = configService.get<string | number>(
          'JWT_ACCESS_EXPIRES_IN_SECONDS',
        );
        let expiresIn = 900;
        if (rawExpiresIn) {
          expiresIn = Number(rawExpiresIn) || 900;
        } else {
          const fallback = configService.get<string>('JWT_ACCESS_EXPIRES_IN');
          if (fallback) {
            if (fallback.endsWith('m')) expiresIn = parseInt(fallback, 10) * 60;
            else if (fallback.endsWith('s')) expiresIn = parseInt(fallback, 10);
            else if (fallback.endsWith('h')) expiresIn = parseInt(fallback, 10) * 3600;
            else expiresIn = Number(fallback) || 900;
          }
        }

        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
  ],

  exports: [
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}