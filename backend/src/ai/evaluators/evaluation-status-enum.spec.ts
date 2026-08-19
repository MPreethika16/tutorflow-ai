import { EvaluationStatus } from '../../generated/prisma/client';

describe('EvaluationStatus Enum (Phase 9.7a)', () => {
  it('contains the new async queue states', () => {
    expect(EvaluationStatus.EVALUATING).toBe('EVALUATING');
    expect(EvaluationStatus.FAILED).toBe('FAILED');
  });

  it('contains the existing lifecycle states', () => {
    expect(EvaluationStatus.PENDING).toBe('PENDING');
    expect(EvaluationStatus.WAITING_FOR_REVIEW).toBe('WAITING_FOR_REVIEW');
    expect(EvaluationStatus.APPROVED).toBe('APPROVED');
  });
});
