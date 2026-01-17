export const PASS_PERCENT = 55;

export function computeScorePercent(pointsAwarded: unknown, pointsTotal: unknown): number {
  const awarded = typeof pointsAwarded === 'number' && Number.isFinite(pointsAwarded) ? pointsAwarded : 0;
  const total = typeof pointsTotal === 'number' && Number.isFinite(pointsTotal) ? pointsTotal : 0;
  if (total <= 0) return 0;
  const pct = (awarded / total) * 100;
  return Math.max(0, Math.min(100, pct));
}

// Simple A–F scale with pass threshold at 55%.
export function computeLetterGrade(scorePercent: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (scorePercent >= 90) return 'A';
  if (scorePercent >= 80) return 'B';
  if (scorePercent >= 70) return 'C';
  if (scorePercent >= PASS_PERCENT) return 'D';
  return 'F';
}

export function computeGradeSummary(opts: {
  pointsAwarded: unknown;
  pointsTotal: unknown;
  isFinal: boolean;
}): {
  scorePercent: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  passed: boolean | null;
} {
  const scorePercent = computeScorePercent(opts.pointsAwarded, opts.pointsTotal);
  if (!opts.isFinal) return { scorePercent, grade: null, passed: null };

  const grade = computeLetterGrade(scorePercent);
  const passed = scorePercent >= PASS_PERCENT;
  return { scorePercent, grade, passed };
}
