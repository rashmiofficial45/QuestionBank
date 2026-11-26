import { gradeSelection, type ChoiceSelection } from "./choice-selection";
import { gradeWritten, isWritten } from "./written-answer";
import { isRanked } from "./ranked-answer";

export type ScoreRow = { answer: ChoiceSelection | null; selected?: ChoiceSelection; interaction?: string };

export function gradeResponse({ answer, selected, interaction }: ScoreRow) {
  if (interaction && isRanked(interaction)) {
    if (!Array.isArray(selected) || !selected.length) return null;
    return Array.isArray(answer) && selected.length === answer.length && selected.every((id, index) => id === answer[index]);
  }
  return interaction && isWritten(interaction)
    ? gradeWritten(interaction, typeof answer === "string" ? answer : null, typeof selected === "string" ? selected : null)
    : gradeSelection(answer, selected);
}

export function scoreTest(rows: ScoreRow[], correctPoints: number, wrongPoints: number) {
  let correct = 0;
  let incorrect = 0;
  for (const row of rows) {
    const result = gradeResponse(row);
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
