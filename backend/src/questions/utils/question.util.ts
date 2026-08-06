import { randomBytes } from 'crypto';

/**
 * Generates a public question identifier.
 *
 * Example:
 * QUE-A1B2C3D4
 */
export function generateQuestionId(): string {
  const suffix = randomBytes(4)
    .toString('hex')
    .toUpperCase();

  return `QUE-${suffix}`;
}