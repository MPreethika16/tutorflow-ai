import { randomBytes } from 'crypto';

/**
 * Generates a public question identifier.
 *
 * Example:
 * QUE-A1B2C3D4E5F60708
 */
export function generateQuestionId(): string {
  const suffix = randomBytes(8)
    .toString('hex')
    .toUpperCase();

  return `QUE-${suffix}`;
}