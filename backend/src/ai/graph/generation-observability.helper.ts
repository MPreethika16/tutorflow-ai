import { Logger } from '@nestjs/common';
import type { AiProviderErrorCode } from '../errors/ai-provider.error';

/**
 * Named latency thresholds for generation observability.
 * Exceeding these does NOT fail the workflow — they produce warnings only.
 * Promote to hard limits only after sustained latency evidence.
 */
export const GENERATION_LATENCY_THRESHOLDS_MS = {
  WARNING: 60_000,   //  60s — single provider call taking longer than typical
  SEVERE: 180_000,   // 180s — total elapsed time across retries approaching timeout risk
} as const;

export type LatencyClassification = 'NORMAL' | 'WARNING' | 'SEVERE';

/**
 * Classify elapsed time against the named latency thresholds.
 * Used purely for observability; does not affect workflow control.
 */
export function classifyLatency(elapsedMs: number): LatencyClassification {
  if (elapsedMs >= GENERATION_LATENCY_THRESHOLDS_MS.SEVERE) return 'SEVERE';
  if (elapsedMs >= GENERATION_LATENCY_THRESHOLDS_MS.WARNING) return 'WARNING';
  return 'NORMAL';
}

/**
 * Minimal structured log context for a generation attempt.
 * Never includes prompts, raw model output, API keys, or student/teacher content.
 */
export type GenerationAttemptLog = {
  subject: string;
  board: string;
  grade: string;
  totalMarks: number;
  attempt: number;
  maxAttempts: number;
  errorCode?: AiProviderErrorCode;
  willRetry?: boolean;
};

export type GenerationOutcomeLog = {
  subject: string;
  board: string;
  grade: string;
  totalMarks: number;
  providerAttempts: number;
  repairCount: number;
  elapsedMs: number;
  latencyClassification: LatencyClassification;
  outcome: 'SUCCESS' | 'PROVIDER_EXHAUSTED' | 'NON_RETRYABLE_ERROR' | 'DOMAIN_REPAIR_FAILED';
};

export class GenerationObservabilityHelper {
  constructor(private readonly logger: Logger) {}

  logAttemptStart(ctx: Pick<GenerationAttemptLog, 'subject' | 'board' | 'grade' | 'totalMarks' | 'attempt' | 'maxAttempts'>): void {
    this.logger.log(
      `[generate] Attempt ${ctx.attempt}/${ctx.maxAttempts} ` +
      `subject="${ctx.subject}" board="${ctx.board}" grade="${ctx.grade}" totalMarks=${ctx.totalMarks}`,
    );
  }

  logAttemptFailure(ctx: GenerationAttemptLog): void {
    const retryMsg = ctx.willRetry ? 'will retry' : 'no retry';
    if (ctx.willRetry) {
      this.logger.warn(
        `[generate] Attempt ${ctx.attempt}/${ctx.maxAttempts} failed ` +
        `errorCode=${ctx.errorCode} ${retryMsg}`,
      );
    } else {
      this.logger.error(
        `[generate] Attempt ${ctx.attempt}/${ctx.maxAttempts} failed ` +
        `errorCode=${ctx.errorCode} ${retryMsg} — propagating`,
      );
    }
  }

  logProviderExhausted(ctx: Pick<GenerationAttemptLog, 'subject' | 'board' | 'grade' | 'maxAttempts' | 'errorCode'>): void {
    this.logger.error(
      `[generate] All ${ctx.maxAttempts} provider attempts exhausted ` +
      `subject="${ctx.subject}" lastErrorCode=${ctx.errorCode}`,
    );
  }

  logDomainRepair(subject: string, repairCount: number, errors: string[]): void {
    this.logger.warn(
      `[repair] Attempt ${repairCount} subject="${subject}" ` +
      `validationErrors=[${errors.join(', ')}]`,
    );
  }

  logOutcome(ctx: GenerationOutcomeLog): void {
    const msg =
      `[workflow] outcome=${ctx.outcome} ` +
      `subject="${ctx.subject}" board="${ctx.board}" grade="${ctx.grade}" ` +
      `providerAttempts=${ctx.providerAttempts} repairs=${ctx.repairCount} ` +
      `elapsedMs=${ctx.elapsedMs} latency=${ctx.latencyClassification}`;

    if (ctx.outcome === 'SUCCESS') {
      if (ctx.latencyClassification === 'SEVERE') {
        this.logger.warn(msg);
      } else {
        this.logger.log(msg);
      }
    } else {
      this.logger.error(msg);
    }
  }
}
