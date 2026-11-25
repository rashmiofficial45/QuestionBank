export type ScoreRow = { answer: string | null; selected?: string };

export function scoreTest(rows: ScoreRow[], correctPoints: number, wrongPoints: number) {
  const correct = rows.filter(({ answer, selected }) => selected && answer === selected).length;
  const incorrect = rows.filter(({ answer, selected }) => selected && answer !== selected).length;
  return {
    correct,
    incorrect,
    unanswered: rows.length - correct - incorrect,
    points: correct * correctPoints - incorrect * wrongPoints,
    maximum: rows.length * correctPoints,
  };
}

export function formatPoints(thirds: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(thirds / 3);
}
