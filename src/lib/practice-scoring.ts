export type ScoreRow = { answer: string | null; selected?: string };

export function scoreTest(rows: ScoreRow[], correctPoints: number, wrongPoints: number) {
  const correct = rows.filter(({ answer, selected }) => selected && answer === selected).length;
  const incorrect = rows.filter(({ answer, selected }) => selected && answer !== selected).length;
  return scoreCounts(correct, incorrect, rows.length, correctPoints, wrongPoints);
}

export function scoreCounts(correct: number, incorrect: number, total: number, correctPoints: number, wrongPoints: number) {
  return {
    correct,
    incorrect,
    unanswered: total - correct - incorrect,
    points: correct * correctPoints - incorrect * wrongPoints,
    maximum: total * correctPoints,
  };
}

export function formatPoints(thirds: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(thirds / 3);
}

export function testAccuracy(correct: number, incorrect: number) {
  const answered = correct + incorrect;
  return answered ? Math.round(correct * 100 / answered) : null;
}
