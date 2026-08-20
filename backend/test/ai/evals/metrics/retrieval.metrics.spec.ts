import { recallAtK, rejectionAccuracy } from './retrieval.metrics';

describe('Retrieval Metrics', () => {
  describe('recallAtK', () => {
    const results = [
      { prompt: 'What is photosynthesis?' },
      { prompt: 'Define gravity.' },
      { prompt: 'Explain the water cycle.' },
    ];

    it('returns true for expected result at rank 1', () => {
      expect(recallAtK(results, 'photosynthesis', 1)).toBe(true);
    });
    it('returns true for expected result at rank 3', () => {
      expect(recallAtK(results, 'water cycle', 3)).toBe(true);
    });
    it('returns false for expected result outside K', () => {
      expect(recallAtK(results, 'water cycle', 2)).toBe(false);
    });
    it('returns false for empty result set', () => {
      expect(recallAtK([], 'photosynthesis', 1)).toBe(false);
    });
  });

  describe('rejectionAccuracy', () => {
    it('returns true for correct out-of-domain rejection (empty)', () => {
      expect(rejectionAccuracy([], true, 0.7)).toBe(true);
    });
    it('returns true for correct out-of-domain rejection (above threshold)', () => {
      expect(rejectionAccuracy([{ distance: 0.8 }], true, 0.7)).toBe(true);
    });
    it('returns false for incorrect out-of-domain acceptance', () => {
      expect(rejectionAccuracy([{ distance: 0.5 }], true, 0.7)).toBe(false);
    });
    it('returns false if results are empty but shouldReject is false', () => {
      expect(rejectionAccuracy([], false)).toBe(false);
    });
  });
});
