export enum MetricClassification {
  HARD_GATE = 'HARD_GATE',
  OBSERVATIONAL = 'OBSERVATIONAL',
}

export type Threshold = {
  classification: MetricClassification;
  value: number; // e.g., 100 for 100%
  operator: '>=' | '==';
};

export const REGRESSION_THRESHOLDS = {
  GENERATION: {
    SCHEMA_VALIDITY: { classification: MetricClassification.HARD_GATE, value: 100, operator: '==' } as Threshold,
    TOTAL_MARKS_CORRECTNESS: { classification: MetricClassification.HARD_GATE, value: 100, operator: '==' } as Threshold,
    TYPED_FIELDS_COMPLETION: { classification: MetricClassification.HARD_GATE, value: 100, operator: '==' } as Threshold,
    SUCCESS_RATE: { classification: MetricClassification.OBSERVATIONAL, value: 80, operator: '>=' } as Threshold,
  },
  GRADING: {
    SCORE_BOUNDS_VALIDITY: { classification: MetricClassification.HARD_GATE, value: 100, operator: '==' } as Threshold,
    FINAL_SUCCESS_RATE: { classification: MetricClassification.OBSERVATIONAL, value: 85, operator: '>=' } as Threshold,
    SUCCESSFUL_ONLY_RANGE_ACCURACY: { classification: MetricClassification.OBSERVATIONAL, value: 70, operator: '>=' } as Threshold,
  },
  RETRIEVAL: {
    RECALL_AT_3: { classification: MetricClassification.OBSERVATIONAL, value: 90, operator: '>=' } as Threshold,
    REJECTION_ACCURACY: { classification: MetricClassification.OBSERVATIONAL, value: 90, operator: '>=' } as Threshold,
  }
};

export enum EvalResult {
  PASS = 'PASS',
  WARNING = 'WARNING',
  REGRESSION = 'REGRESSION'
}

/**
 * Evaluates a metric against its defined threshold policy.
 * @param metricName Name of the metric for reporting
 * @param actual The actual percentage score computed
 * @param threshold The threshold policy
 * @param isStrict If true, observational failures are escalated to REGRESSION
 * @returns The resulting status classification
 */
export function evaluateMetric(
  metricName: string, 
  actual: number, 
  threshold: Threshold, 
  isStrict: boolean
): EvalResult {
  const isPassing = threshold.operator === '==' 
    ? actual === threshold.value 
    : actual >= threshold.value;

  if (isPassing) {
    return EvalResult.PASS;
  }

  // It failed the threshold requirement
  if (threshold.classification === MetricClassification.HARD_GATE) {
    return EvalResult.REGRESSION;
  }

  // It's an observational metric that failed
  if (isStrict) {
    return EvalResult.REGRESSION;
  }

  return EvalResult.WARNING;
}

export function printEvaluationResult(
  metricName: string,
  actual: number,
  threshold: Threshold,
  isStrict: boolean
): EvalResult {
  const result = evaluateMetric(metricName, actual, threshold, isStrict);
  const operatorStr = threshold.operator;
  const targetStr = `${operatorStr}${threshold.value}%`;
  
  const paddedName = metricName.padEnd(35);
  const formattedActual = `${actual}%`.padEnd(5);
  
  if (result === EvalResult.PASS) {
    console.log(`[PASS]       ${paddedName} | actual: ${formattedActual} (target: ${targetStr})`);
  } else if (result === EvalResult.WARNING) {
    console.log(`[WARNING]    ${paddedName} | actual: ${formattedActual} (target: ${targetStr}) - Observational failure`);
  } else {
    console.log(`[REGRESSION] ${paddedName} | actual: ${formattedActual} (target: ${targetStr})`);
  }

  return result;
}
