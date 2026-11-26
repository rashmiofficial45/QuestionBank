import { createHash } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { db } from "@/database";
import { drafts, editorialSettings, imports, questions } from "@/database/schema";
import type { Content } from "@/lib/content";
import { displayText } from "@/modules/study";

function normalized(text: string) {
  return text.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

export function fingerprint(content: Content) {
  const prompt = normalized(displayText(content));
  if (!prompt || content.blocks.some((block) => block.type === "image" || (block.type === "source_crop" && !block.reference)) ||
      content.options.some((option) => option.blocks?.some((block) => block.type !== "paragraph"))) return null;
  const options = content.options.map((option) => normalized(option.text));
  const refersToLabels = options.some((option) => /\b(?:option|both|either|neither)\b.*\b[a-z]\b/u.test(option));
  if (!refersToLabels && ["single_choice", "multiple_choice", "true_false"].includes(content.interaction)) options.sort();
  const prompts = content.interaction === "pair_matching" ? content.prompts.map(normalized) : [];
  return createHash("sha256").update(JSON.stringify([prompt, content.interaction, prompts, options])).digest("hex");
}

export async function duplicateGroups() {
  const [rows, dismissed] = await Promise.all([
    db.select({
      id: drafts.id, importId: drafts.importId, number: drafts.number, content: drafts.content, issues: drafts.issues,
      title: imports.title, archived: questions.archivedAt, published: questions.id,
    }).from(drafts).innerJoin(imports, eq(imports.id, drafts.importId)).leftJoin(questions, eq(questions.draftId, drafts.id)),
    db.select().from(editorialSettings).where(like(editorialSettings.key, "duplicate:%")),
  ]);
  const ignored = new Map(dismissed.map(({ key, value }) => [key, value]));
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    if (row.archived || row.issues.some((issue) => issue.startsWith("Excluded as a duplicate."))) continue;
    const key = fingerprint(row.content);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return Array.from(groups).flatMap(([key, rows]) => {
    const ids = rows.map(({ id }) => id).sort().join(",");
    return rows.length > 1 && ignored.get(`duplicate:${key}`) !== ids ? [{ key, ids, rows }] : [];
  });
}
