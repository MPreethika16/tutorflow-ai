import { ConfigService } from '@nestjs/config';

/**
 * Resolves the effective JWT access expiration in seconds from ConfigService.
 * Prioritizes JWT_ACCESS_EXPIRES_IN_SECONDS, then falls back to legacy
 * JWT_ACCESS_EXPIRES_IN (with 'm', 's', 'h' unit parsing), defaulting to 900.
 */
export function resolveJwtExpiresInSeconds(
  configService: ConfigService,
): number {
  const rawExpiresIn = configService.get<string | number>(
    'JWT_ACCESS_EXPIRES_IN_SECONDS',
  );
  if (
    rawExpiresIn !== undefined &&
    rawExpiresIn !== null &&
    rawExpiresIn !== ''
  ) {
    const parsed = Number(rawExpiresIn);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const fallback = configService.get<string>('JWT_ACCESS_EXPIRES_IN');
  if (fallback) {
    if (fallback.endsWith('m')) return parseInt(fallback, 10) * 60;
    if (fallback.endsWith('s')) return parseInt(fallback, 10);
    if (fallback.endsWith('h')) return parseInt(fallback, 10) * 3600;
    const parsedFallback = Number(fallback);
    if (!Number.isNaN(parsedFallback) && parsedFallback > 0) {
      return parsedFallback;
    }
  }

  return 900;
}
