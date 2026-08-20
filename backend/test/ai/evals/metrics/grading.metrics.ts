export function marksWithinExpectedRange(suggestedMarks: number, expectedRange: [number, number]): boolean {
  return suggestedMarks >= expectedRange[0] && suggestedMarks <= expectedRange[1];
}

export function absoluteMarkError(suggestedMarks: number, expectedMarks: number): number {
  return Math.abs(suggestedMarks - expectedMarks);
}

export function scoreBoundsValid(suggestedMarks: number, questionMarks: number): boolean {
  return suggestedMarks >= 0 && suggestedMarks <= questionMarks;
}
