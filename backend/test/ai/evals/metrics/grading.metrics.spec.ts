import { marksWithinExpectedRange, absoluteMarkError, scoreBoundsValid } from './grading.metrics';

describe('Grading Metrics', () => {
  describe('marksWithinExpectedRange', () => {
    it('returns true for lower/upper range boundaries', () => {
      expect(marksWithinExpectedRange(2, [2, 4])).toBe(true);
      expect(marksWithinExpectedRange(4, [2, 4])).toBe(true);
      expect(marksWithinExpectedRange(3, [2, 4])).toBe(true);
    });
    it('returns false for outside expected range', () => {
      expect(marksWithinExpectedRange(1, [2, 4])).toBe(false);
      expect(marksWithinExpectedRange(5, [2, 4])).toBe(false);
    });
  });

  describe('absoluteMarkError', () => {
    it('returns exact mark error = 0', () => {
      expect(absoluteMarkError(5, 5)).toBe(0);
    });
    it('returns positive distance for over/under-scoring', () => {
      expect(absoluteMarkError(7, 5)).toBe(2);
      expect(absoluteMarkError(3, 5)).toBe(2);
    });
  });

  describe('scoreBoundsValid', () => {
    it('returns true for zero marks and maximum marks', () => {
      expect(scoreBoundsValid(0, 5)).toBe(true);
      expect(scoreBoundsValid(5, 5)).toBe(true);
      expect(scoreBoundsValid(3, 5)).toBe(true);
    });
    it('returns false for over-scoring or negative scoring', () => {
      expect(scoreBoundsValid(6, 5)).toBe(false);
      expect(scoreBoundsValid(-1, 5)).toBe(false);
    });
  });
});
