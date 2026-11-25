export type ChoiceSelection = string | string[];

export function choiceIds(selection?: ChoiceSelection | null): string[] {
  return typeof selection === "string" ? (selection ? [selection] : []) : selection ?? [];
}

export function gradeSelection(answer?: ChoiceSelection | null, selection?: ChoiceSelection | null): boolean | null {
  const selected = new Set(choiceIds(selection));
  if (!selected.size) return null;
  const expected = choiceIds(answer);
  return selected.size === expected.length && expected.every((id) => selected.has(id));
}
