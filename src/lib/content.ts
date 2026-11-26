import { z } from "zod";
import { choiceIds } from "./choice-selection";
import { isWritten, normalizeWritten } from "./written-answer";
import { isRanked } from "./ranked-answer";

export const textStyles = ["paragraph", "heading", "passage", "quote", "code", "equation"] as const;
export const presentations = {
  matching: "Match the following",
  chronology: "Chronological ordering",
  comprehension: "Passage comprehension",
} as const;
export const presentationSchema = z.enum(["matching", "chronology", "comprehension"]);
const paragraph = z.object({ id: z.string(), type: z.literal("paragraph"), text: z.string().trim().min(1), style: z.enum(textStyles).optional() });
const labeledText = z.object({ label: z.string().trim().min(1).max(40), text: z.string().trim().min(1) });
const statements = z.object({
  id: z.string(),
  type: z.literal("statements"),
  items: z.array(labeledText).min(2).max(50),
});
const assertionReason = z.object({
  id: z.string(),
  type: z.literal("assertion_reason"),
  assertion: labeledText,
  reason: labeledText,
});
const crop = z.object({
  id: z.string(),
  type: z.literal("source_crop"),
  page: z.number().int().positive(),
  file: z.string().regex(/^page-[0-9]+-[0-9]+\.png$/),
  alt: z.string().min(1),
  reference: z.boolean().optional(),
});
const cell = z.string().trim().max(2000);
const table = z.object({
  id: z.string(),
  type: z.literal("table"),
  page: z.number().int().positive(),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  headers: z.array(cell).min(2).max(12),
  rows: z.array(z.array(cell).min(2).max(12)).min(1).max(39),
}).refine(({ headers, rows, bounds }) =>
  rows.every((row) => row.length === headers.length) && bounds[2] > bounds[0] && bounds[3] > bounds[1],
{ message: "Table requires a valid source rectangle and the same number of cells in every row." });
export const optionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().trim().min(1).max(12),
  text: z.string().trim().min(1).max(8000),
  blocks: z.array(z.discriminatedUnion("type", [
    paragraph.extend({ style: z.literal("equation"), text: z.string().trim().min(1).max(8000) }), crop,
  ])).min(1).max(6).optional(),
});
const question = z.object({
  version: z.literal(1),
  presentation: presentationSchema.optional(),
  blocks: z.array(z.discriminatedUnion("type", [paragraph, statements, assertionReason, crop, table])).min(1).max(100),
  options: z.array(optionSchema).max(12),
  explanation: z.string().trim().max(8000),
});
export const questionSchema = z.discriminatedUnion("interaction", [
  question.extend({ interaction: z.literal("single_choice"), answer: z.string().nullable() }),
  question.extend({ interaction: z.literal("true_false"), answer: z.string().nullable() }),
  question.extend({ interaction: z.literal("multiple_choice"), answer: z.array(z.string()).max(12).nullable() }),
  question.extend({ interaction: z.literal("ordering"), answer: z.array(z.string()).max(12).nullable() }),
  question.extend({ interaction: z.literal("pair_matching"), answer: z.array(z.string()).max(12).nullable(), prompts: z.array(z.string().trim().min(1).max(1000)).max(12) }),
  question.extend({ interaction: z.enum(["numeric", "fill_blank", "short_answer", "descriptive"]), answer: z.string().trim().max(8000).nullable() }),
]);
export type Content = z.infer<typeof questionSchema>;

export function validSelection(content: Content, values: FormDataEntryValue[]) {
  const ids = z.array(z.string().min(1).max(64)).max(12).safeParse(values);
  if (!ids.success || new Set(ids.data).size !== ids.data.length ||
      (!isRanked(content.interaction) && content.interaction !== "multiple_choice" && ids.data.length > 1) ||
      !ids.data.every((id) => content.options.some((option) => option.id === id))) return null;
  if (isRanked(content.interaction) && ids.data.length) {
    const expected = content.interaction === "pair_matching" ? content.prompts.length : content.options.length;
    if (ids.data.length !== expected) return null;
  }
  return ids.data;
}

export function publicationIssues(content: Content): string[] {
  const issues = [];
  if (!content.blocks.some((block) => block.type !== "source_crop")) issues.push("Provide question text.");
  if (isWritten(content.interaction)) {
    if (typeof content.answer !== "string" || !normalizeWritten(content.interaction, content.answer)) {
      issues.push(content.interaction === "numeric" ? "Provide a valid decimal answer." : "Provide a reference answer.");
    }
    return issues;
  }
  const ids = new Set(content.options.map((option) => option.id));
  if (ids.size < 2 || ids.size !== content.options.length || new Set(content.options.map((option) => option.label.toLowerCase())).size !== ids.size) issues.push("Provide at least two options with distinct labels and identifiers.");
  if ((content.interaction === "true_false" || isRanked(content.interaction)) && content.options.some((option) => option.blocks?.length)) {
    issues.push("Use text options for True/False, matching, and ordering questions.");
  }
  if (content.interaction === "true_false") {
    const values = new Set(content.options.map((option) => option.text.trim().toLowerCase()));
    if (content.options.length !== 2 || !values.has("true") || !values.has("false")) {
      issues.push("True/False questions need exactly one True option and one False option.");
    }
  }
  const answers = choiceIds(content.answer);
  const minimum = content.interaction === "multiple_choice" ? 2 : 1;
  if (isRanked(content.interaction)) {
    const expected = content.interaction === "pair_matching" ? content.prompts.length : content.options.length;
    if (expected < 2 || expected > content.options.length) issues.push("Provide at least two prompts and enough distinct matching choices.");
    if (answers.length !== expected || !validSelection(content, answers)) issues.push("Provide a complete sequence of distinct option labels.");
    return issues;
  }
  if (answers.length < minimum || new Set(answers).size !== answers.length || !answers.every((id) => ids.has(id))) {
    issues.push(minimum === 2 ? "Select at least two distinct correct answers." : "Select a valid correct answer.");
  }
  return issues;
}
