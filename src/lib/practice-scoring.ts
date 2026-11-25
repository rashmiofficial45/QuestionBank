import { gradeSelection, type ChoiceSelection } from "./choice-selection";

export type ScoreRow = { answer: ChoiceSelection | null; selected?: ChoiceSelection };

export function scoreTest(rows: ScoreRow[], correctPoints: number, wrongPoints: number) {
  let correct = 0;
  let incorrect = 0;
  for (const { answer, selected } of rows) {
    const result = gradeSelection(answer, selected);
    if (result === true) correct++;
    if (result === false) incorrect++;
  }
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
