import { Logger } from '@nestjs/common';
import {
  classifyLatency,
  GENERATION_LATENCY_THRESHOLDS_MS,
  GenerationObservabilityHelper,
} from './generation-observability.helper';

describe('GenerationObservabilityHelper', () => {
  // ----------------------------------------------------------------
  // classifyLatency — boundary tests
  // ----------------------------------------------------------------
  describe('classifyLatency', () => {
    it('returns NORMAL below the warning threshold', () => {
      expect(classifyLatency(0)).toBe('NORMAL');
      expect(classifyLatency(GENERATION_LATENCY_THRESHOLDS_MS.WARNING - 1)).toBe('NORMAL');
    });

    it('returns WARNING at the warning threshold', () => {
      expect(classifyLatency(GENERATION_LATENCY_THRESHOLDS_MS.WARNING)).toBe('WARNING');
    });

    it('returns WARNING between WARNING and SEVERE thresholds', () => {
      expect(classifyLatency(GENERATION_LATENCY_THRESHOLDS_MS.WARNING + 1)).toBe('WARNING');
      expect(classifyLatency(GENERATION_LATENCY_THRESHOLDS_MS.SEVERE - 1)).toBe('WARNING');
    });

    it('returns SEVERE at the severe threshold', () => {
      expect(classifyLatency(GENERATION_LATENCY_THRESHOLDS_MS.SEVERE)).toBe('SEVERE');
    });

    it('returns SEVERE above the severe threshold', () => {
      expect(classifyLatency(GENERATION_LATENCY_THRESHOLDS_MS.SEVERE + 10_000)).toBe('SEVERE');
    });
  });

  // ----------------------------------------------------------------
  // GenerationObservabilityHelper — logging correctness
  // ----------------------------------------------------------------
  describe('GenerationObservabilityHelper', () => {
    let logSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;
    let obs: GenerationObservabilityHelper;

    const ctx = {
      subject: 'Mathematics',
      board: 'CBSE',
      grade: '10',
      totalMarks: 20,
      attempt: 1,
      maxAttempts: 3,
    };

    beforeEach(() => {
      logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
      obs = new GenerationObservabilityHelper(new Logger('test'));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('logs attempt start via logger.log without prompt/content', () => {
      obs.logAttemptStart(ctx);
      expect(logSpy).toHaveBeenCalledTimes(1);
      const msg: string = logSpy.mock.calls[0][0];
      expect(msg).toContain('[generate]');
      expect(msg).toContain('Attempt 1/3');
      expect(msg).toContain('subject="Mathematics"');
      // Must not contain raw prompt content
      expect(msg).not.toContain('messages');
      expect(msg).not.toContain('content');
    });

    it('logs retryable failure as warn with willRetry=true', () => {
      obs.logAttemptFailure({ ...ctx, errorCode: 'INVALID_RESPONSE', willRetry: true });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
      const msg: string = warnSpy.mock.calls[0][0];
      expect(msg).toContain('INVALID_RESPONSE');
      expect(msg).toContain('will retry');
    });

    it('logs non-retryable failure as error with willRetry=false', () => {
      obs.logAttemptFailure({ ...ctx, errorCode: 'AUTHENTICATION', willRetry: false });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
      const msg: string = errorSpy.mock.calls[0][0];
      expect(msg).toContain('AUTHENTICATION');
      expect(msg).toContain('propagating');
    });

    it('logs provider exhausted as error', () => {
      obs.logProviderExhausted({ subject: 'Science', board: 'CBSE', grade: '8', maxAttempts: 3, errorCode: 'TIMEOUT' });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const msg: string = errorSpy.mock.calls[0][0];
      expect(msg).toContain('exhausted');
      expect(msg).toContain('TIMEOUT');
    });

    it('logs domain repair as warn with error codes', () => {
      obs.logDomainRepair('Mathematics', 1, ['TOTAL_MARKS_MISMATCH']);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg: string = warnSpy.mock.calls[0][0];
      expect(msg).toContain('[repair]');
      expect(msg).toContain('TOTAL_MARKS_MISMATCH');
      // Must NOT contain prompt text
      expect(msg).not.toContain('Generate a paper');
    });

    it('logs SUCCESS outcome without sensitive data', () => {
      obs.logOutcome({
        subject: 'Physics', board: 'CBSE', grade: '11', totalMarks: 50,
        providerAttempts: 2, repairCount: 1,
        elapsedMs: 45_000, latencyClassification: 'NORMAL',
        outcome: 'SUCCESS',
      });
      expect(logSpy).toHaveBeenCalledTimes(1);
      const msg: string = logSpy.mock.calls[0][0];
      expect(msg).toContain('outcome=SUCCESS');
      expect(msg).toContain('providerAttempts=2');
      expect(msg).toContain('repairs=1');
      expect(msg).not.toContain('messages');
      expect(msg).not.toContain('prompt');
    });

    it('logs SEVERE latency SUCCESS outcome as warn, not log', () => {
      obs.logOutcome({
        subject: 'Physics', board: 'CBSE', grade: '11', totalMarks: 50,
        providerAttempts: 3, repairCount: 0,
        elapsedMs: GENERATION_LATENCY_THRESHOLDS_MS.SEVERE + 1000,
        latencyClassification: 'SEVERE',
        outcome: 'SUCCESS',
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('logs PROVIDER_EXHAUSTED outcome as error', () => {
      obs.logOutcome({
        subject: 'Chemistry', board: 'CBSE', grade: '12', totalMarks: 30,
        providerAttempts: 3, repairCount: 0,
        elapsedMs: 180_000, latencyClassification: 'SEVERE',
        outcome: 'PROVIDER_EXHAUSTED',
      });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('final providerAttempts count is preserved in outcome log', () => {
      obs.logOutcome({
        subject: 'Biology', board: 'ICSE', grade: '9', totalMarks: 25,
        providerAttempts: 3, repairCount: 0,
        elapsedMs: 90_000, latencyClassification: 'WARNING',
        outcome: 'SUCCESS',
      });
      const msg: string = logSpy.mock.calls[0][0];
      expect(msg).toContain('providerAttempts=3');
    });
  });
});
