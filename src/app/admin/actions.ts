"use server";

import { and, eq } from "drizzle-orm";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/database";
import { drafts, imports, questions } from "@/database/schema";
import { publicationIssues, questionSchema, type Content } from "@/lib/content";
import { requireAdmin, storageRoot } from "@/modules/imports";
import { displayText } from "@/modules/study";

const MAX_PDF = 10 * 1024 * 1024;
const uploadMeta = z.object({ title: z.string().trim().min(1).max(120), subject: z.string().trim().min(1).max(60) });
export type FormStatus = { error?: string; saved?: boolean };

async function validPDF(file: FormDataEntryValue | null): Promise<File | null> {
  if (!(file instanceof File) || file.size < 8 || file.size > MAX_PDF) return null;
  if (!file.name.toLowerCase().endsWith(".pdf")) return null;
  const signature = await file.slice(0, 5).text();
  return signature === "%PDF-" ? file : null;
}

export async function uploadPapers(_previous: FormStatus, form: FormData): Promise<FormStatus> {
  await requireAdmin();
  const meta = uploadMeta.safeParse({ title: form.get("title"), subject: form.get("subject") });
  if (!meta.success) return { error: "Enter a paper title and a subject." };
  const [paper, key] = await Promise.all([validPDF(form.get("paper")), validPDF(form.get("key"))]);
  if (!paper || !key) return { error: "Select a question paper and answer key as PDF files up to 10 MB each." };
  const id = crypto.randomUUID();
  const directory = join(storageRoot(), id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    for (const [name, file] of [["paper.pdf", paper], ["key.pdf", key]] as const) {
      const handle = await open(join(directory, name), "wx", 0o600);
      try {
        await handle.writeFile(new Uint8Array(await file.arrayBuffer()));
      } finally {
        await handle.close();
      }
    }
  } catch {
    await rm(directory, { recursive: true, force: true });
    return { error: "The PDF files could not be stored. Try uploading again." };
  }
  try {
    await db.insert(imports).values({ id, ...meta.data, paperName: paper.name.slice(0, 255), keyName: key.name.slice(0, 255) });
  } catch (error) {
    console.error(JSON.stringify({ event: "import.queue_failed", id, reason: error instanceof Error ? error.name : "unknown" }));
    return { error: "The import could not be queued. Open PDF imports to check its status before uploading again." };
  }
  revalidatePath("/admin/imports");
  redirect(`/admin/imports/${id}`);
}

export async function saveDraft(importId: string, id: string, _previous: FormStatus, form: FormData): Promise<FormStatus> {
  await requireAdmin();
  if (!z.uuid().safeParse(importId).success || !z.uuid().safeParse(id).success) return { error: "Draft unavailable." };
  const result = await db.transaction(async (tx) => {
    const [draft] = await tx.select().from(drafts).where(and(eq(drafts.id, id), eq(drafts.importId, importId))).for("update");
    if (!draft) return { error: "Draft unavailable." };
    if (await tx.$count(questions, eq(questions.draftId, id))) return { error: "This question is already published." };
    const stem = form.get("stem");
    const answer = form.get("answer");
    const optionInputs = draft.content.options.map((option) => ({ ...option, text: form.get(`option-${option.id}`) }));
    const content = questionSchema.safeParse({
      ...draft.content,
      blocks: draft.content.blocks.map((block) => block.type === "paragraph" ? { ...block, text: stem } : block),
      options: optionInputs,
      answer: answer === "" ? null : answer,
      explanation: form.get("explanation"),
    });
    if (!content.success) return { error: "Provide question text and a value for every option." };
    if (draft.content.blocks.some((block) => block.type === "source_crop") && stem !== displayText(draft.content)) {
      return { error: "This prompt includes a source image. Its text stays linked to that image in this preview." };
    }
    const issues = form.get("verified") === "on" ? [] : draft.issues;
    await tx.update(drafts).set({ content: content.data, issues, editedAt: new Date() }).where(eq(drafts.id, id));
    return { saved: true };
  });
  revalidatePath(`/admin/imports/${importId}`);
  return result;
}

export async function publishImport(id: string, form: FormData) {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return;
  const selected = z.uuid().nullable().safeParse(form.get("draft"));
  if (!selected.success) return;
  const published = await db.transaction(async (tx) => {
    const [paper] = await tx.select().from(imports).where(and(eq(imports.id, id), eq(imports.status, "ready"))).for("update");
    if (!paper) return 0;
    const rows = await tx.select().from(drafts).where(and(eq(drafts.importId, id), selected.data ? eq(drafts.id, selected.data) : undefined))
      .orderBy(drafts.number).for("update");
    const eligible = rows.flatMap((draft) => {
      const content = questionSchema.safeParse(draft.content);
      if (!content.success || draft.issues.length || publicationIssues(content.data).length) return [];
      const verified: Content = content.data;
      return [{
        draftId: draft.id, importId: id, slug: `${id}-${draft.number}`, subject: paper.subject, topic: "General",
        source: paper.title, difficulty: "Unrated", number: draft.number, content: verified,
        searchText: [displayText(verified), paper.subject, paper.title].join("\n"),
      }];
    });
    if (!eligible.length) return 0;
    return (await tx.insert(questions).values(eligible).onConflictDoNothing({ target: questions.draftId }).returning({ id: questions.id })).length;
  });
  revalidatePath("/", "layout");
  redirect(`/admin/imports/${id}?published=${published}`);
}
