import { z } from "zod";
import { choiceIds } from "./choice-selection";

const paragraph = z.object({ id: z.string(), type: z.literal("paragraph"), text: z.string().trim().min(1) });
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
});
const question = z.object({
  version: z.literal(1),
  blocks: z.array(z.discriminatedUnion("type", [paragraph, crop, table])).min(1).max(100),
  options: z.array(optionSchema).max(12),
  explanation: z.string().trim().max(8000),
});
export const questionSchema = z.discriminatedUnion("interaction", [
  question.extend({ interaction: z.literal("single_choice"), answer: z.string().nullable() }),
  question.extend({ interaction: z.literal("multiple_choice"), answer: z.array(z.string()).max(12).nullable() }),
]);
export type Content = z.infer<typeof questionSchema>;

export function validSelection(content: Content, values: FormDataEntryValue[]) {
  const ids = z.array(z.string().min(1).max(64)).max(12).safeParse(values);
  if (!ids.success || new Set(ids.data).size !== ids.data.length ||
      (content.interaction === "single_choice" && ids.data.length > 1) ||
      !ids.data.every((id) => content.options.some((option) => option.id === id))) return null;
  return ids.data;
}

export function publicationIssues(content: Content): string[] {
  const issues = [];
  const ids = new Set(content.options.map((option) => option.id));
  if (ids.size < 2 || ids.size !== content.options.length || new Set(content.options.map((option) => option.label.toLowerCase())).size !== ids.size) issues.push("Provide at least two options with distinct labels and identifiers.");
  const answers = choiceIds(content.answer);
  const minimum = content.interaction === "multiple_choice" ? 2 : 1;
  if (answers.length < minimum || new Set(answers).size !== answers.length || !answers.every((id) => ids.has(id))) {
    issues.push(minimum === 2 ? "Select at least two distinct correct answers." : "Select a valid correct answer.");
  }
  if (!content.blocks.some((block) => block.type === "paragraph")) issues.push("Provide question text.");
  return issues;
}
