import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JwtModule,
  type JwtModuleOptions,
} from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './guards/must-change-password.guard';
import { RolesGuard } from './guards/roles.guard';
import { resolveJwtExpiresInSeconds } from './utils/jwt-config.util';

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

        const expiresIn = resolveJwtExpiresInSeconds(configService);

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
    MustChangePasswordGuard,
  ],

  exports: [
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    MustChangePasswordGuard,
  ],
})
export class AuthModule {}