import { z } from "zod";

const paragraph = z.object({ id: z.string(), type: z.literal("paragraph"), text: z.string().trim().min(1) });
const crop = z.object({
  id: z.string(),
  type: z.literal("source_crop"),
  page: z.number().int().positive(),
  file: z.string().regex(/^page-[0-9]+-[0-9]+\.png$/),
  alt: z.string().min(1),
});
export const optionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().trim().min(1).max(12),
  text: z.string().trim().min(1).max(8000),
});
export const questionSchema = z.object({
  version: z.literal(1),
  interaction: z.literal("single_choice"),
  blocks: z.array(z.discriminatedUnion("type", [paragraph, crop])).min(1).max(100),
  options: z.array(optionSchema).max(12),
  answer: z.string().nullable(),
  explanation: z.string().trim().max(8000),
});
export type Content = z.infer<typeof questionSchema>;

export function publicationIssues(content: Content): string[] {
  const issues = [];
  const ids = new Set(content.options.map((option) => option.id));
  if (ids.size < 2 || ids.size !== content.options.length) issues.push("Provide at least two options with distinct identifiers.");
  if (!content.answer || !ids.has(content.answer)) issues.push("Select a valid correct answer.");
  if (!content.blocks.some((block) => block.type === "paragraph")) issues.push("Provide question text.");
  return issues;
}
