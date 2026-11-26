import { z } from "zod";
import type { ChoiceSelection } from "./choice-selection";
import { validSelection, type Content } from "./content";
import { gradeResponse } from "./practice-scoring";
import { isRanked } from "./ranked-answer";
import { gradeWritten, isWritten, normalizeWritten } from "./written-answer";

export type AnswerResult = { correct?: boolean; selected?: ChoiceSelection; answer?: ChoiceSelection; explanation?: string; explanationCrops?: Content["explanationCrops"]; error?: string };
type Attempt = { responseText?: string; optionId?: string | null; optionIds?: string[] | null; correct: boolean };

export function checkSubmission(content: Content, values: FormDataEntryValue[]): { result: AnswerResult; attempt?: Attempt } {
  const { answer, interaction, explanation, explanationCrops } = content;
  if (isWritten(interaction)) {
    const input = z.string().trim().min(1).max(8000).safeParse(values[0]);
    if (!input.success || values.length !== 1 || typeof answer !== "string" || !normalizeWritten(interaction, input.data)) {
      return { result: { error: interaction === "numeric" ? "Enter a valid decimal answer." : "Enter a response before reviewing." } };
    }
    if (interaction === "descriptive") return { result: { answer, selected: input.data, explanation } };
    const correct = gradeWritten(interaction, answer, input.data) === true;
    return { result: { answer, selected: input.data, correct, explanation, explanationCrops }, attempt: { responseText: input.data, correct } };
  }
  const selected = validSelection(content, values);
  if (!answer || !selected?.length) return { result: { error: "This option is unavailable. Reload the question and try again." } };
  const multiple = interaction === "multiple_choice" || isRanked(interaction);
  const correct = gradeResponse({ answer, selected, interaction }) === true;
  return { result: { correct, selected, answer, explanation, explanationCrops },
    attempt: { optionId: multiple ? null : selected[0], optionIds: multiple ? selected : null, correct } };
}
