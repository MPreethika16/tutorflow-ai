import { evaluateMetric, MetricClassification, EvalResult } from './regression-thresholds';

describe('Regression Policy', () => {
  describe('Hard Gates', () => {
    const hardGate100 = { classification: MetricClassification.HARD_GATE, value: 100, operator: '==' as const };
    
    it('passes when metric exactly meets 100%', () => {
      const result = evaluateMetric('test', 100, hardGate100, false);
      expect(result).toBe(EvalResult.PASS);
    });

    it('returns REGRESSION when metric fails a hard gate, regardless of strict mode', () => {
      const resultNonStrict = evaluateMetric('test', 99, hardGate100, false);
      expect(resultNonStrict).toBe(EvalResult.REGRESSION);

      const resultStrict = evaluateMetric('test', 99, hardGate100, true);
      expect(resultStrict).toBe(EvalResult.REGRESSION);
    });
  });

  describe('Observational Thresholds', () => {
    const obsThreshold85 = { classification: MetricClassification.OBSERVATIONAL, value: 85, operator: '>=' as const };

    it('passes when metric meets or exceeds threshold', () => {
      expect(evaluateMetric('test', 85, obsThreshold85, false)).toBe(EvalResult.PASS);
      expect(evaluateMetric('test', 90, obsThreshold85, false)).toBe(EvalResult.PASS);
    });

    it('returns WARNING when failing an observational metric in non-strict mode', () => {
      const result = evaluateMetric('test', 80, obsThreshold85, false);
      expect(result).toBe(EvalResult.WARNING);
    });

    it('returns REGRESSION when failing an observational metric in strict mode', () => {
      const result = evaluateMetric('test', 80, obsThreshold85, true);
      expect(result).toBe(EvalResult.REGRESSION);
    });
  });
});
