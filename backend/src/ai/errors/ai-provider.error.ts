export type AiProviderErrorCode =
  | 'CONFIGURATION'
  | 'AUTHENTICATION'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN';

export class AiProviderError extends Error {
  constructor(
    public readonly code: AiProviderErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}