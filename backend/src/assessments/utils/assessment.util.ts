import { randomBytes } from 'crypto';

/**
 * Generates a public assessment ID.
 *
 * Example:
 * ASM-4A91C2D8
 */
export function generateAssessmentId(): string {
  const suffix = randomBytes(4)
    .toString('hex')
    .toUpperCase();

  return `ASM-${suffix}`;
}