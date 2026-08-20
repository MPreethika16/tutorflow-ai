export function recallAtK(results: { prompt: string }[], expectedFragment: string, k: number): boolean {
  if (!results || results.length === 0) return false;
  const topK = results.slice(0, k);
  return topK.some((r) => r.prompt.includes(expectedFragment));
}

export function rejectionAccuracy(results: any[], shouldReject: boolean, thresholdDistance?: number): boolean {
  if (!shouldReject) {
    return results.length > 0;
  }
  if (results.length === 0) return true;
  if (thresholdDistance !== undefined) {
    return results[0].distance > thresholdDistance;
  }
  return false;
}
