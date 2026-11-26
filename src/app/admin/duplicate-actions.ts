"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/database";
import { drafts, editorialEvents, editorialSettings, questions } from "@/database/schema";
import { duplicateGroups, fingerprint } from "@/modules/duplicates";
import { requireAdmin } from "@/modules/imports";

export async function keepDuplicates(key: string) {
  await requireAdmin();
  if (!/^[a-f0-9]{64}$/.test(key)) return;
  const group = (await duplicateGroups()).find((item) => item.key === key);
  if (!group) return;
  await db.insert(editorialSettings).values({ key: `duplicate:${key}`, value: group.ids })
    .onConflictDoUpdate({ target: editorialSettings.key, set: { value: group.ids } });
  revalidatePath("/admin/duplicates");
}

export async function suppressDuplicate(id: string, key: string) {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return;
  const group = (await duplicateGroups()).find((item) => item.key === key && item.rows.some((row) => row.id === id));
  if (!group) return;
  await db.transaction(async (tx) => {
    const [draft] = await tx.select().from(drafts).where(eq(drafts.id, id)).for("update");
    if (!draft || fingerprint(draft.content) !== key) return;
    const suppressed = "Excluded as a duplicate. Change the content or explicitly verify it to publish.";
    const issues = draft.issues.includes(suppressed) ? draft.issues : [...draft.issues, suppressed];
    await tx.update(drafts).set({ issues, generation: draft.generation + 1 }).where(eq(drafts.id, id));
    await tx.update(questions).set({ archivedAt: new Date() }).where(and(eq(questions.draftId, id), sql`${questions.archivedAt} is null`));
    await tx.insert(editorialEvents).values({ importId: draft.importId, questionNumber: draft.number, type: "Duplicate excluded", detail: "Retained the draft and any prior published revisions." });
  });
  revalidatePath("/", "layout");
}
