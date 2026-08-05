import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * Number of bcrypt salt rounds.
 *
 * Higher = more secure but slower.
 * 12 is a common production choice.
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Generates a secure temporary password.
 *
 * Example:
 * Ab3XkP9m#7
 *
 * This password is returned ONLY ONCE
 * to the teacher after a password reset.
 */
export function generateTemporaryPassword(): string {
  const randomPart = randomBytes(6).toString('base64url');

  return `${randomPart}#7`;
}

/**
 * Converts a plain password into a bcrypt hash.
 *
 * The hash is what gets stored in PostgreSQL.
 * Never store the plain password.
 */
export async function hashPassword(
  password: string,
): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compares a plain password with the stored hash.
 *
 * Used during login.
 *
 * Returns:
 * true  -> password is correct
 * false -> password is incorrect
 */
export async function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}