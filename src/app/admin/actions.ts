"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/database";
import { drafts, editorialEvents, imports, questions, questionVersions } from "@/database/schema";
import { choiceIds } from "@/lib/choice-selection";
import { optionSchema, publicationIssues, questionSchema } from "@/lib/content";
import { isWritten } from "@/lib/written-answer";
import { isRanked } from "@/lib/ranked-answer";
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

function fileProvided(value: FormDataEntryValue | null) {
  return value !== null && (!(value instanceof File) || value.size > 0);
}

export async function uploadPapers(_previous: FormStatus, form: FormData): Promise<FormStatus> {
  await requireAdmin();
  const meta = uploadMeta.safeParse({ title: form.get("title"), subject: form.get("subject") });
  if (!meta.success) return { error: "Enter a paper title and a subject." };
  const keyInput = form.get("key");
  const [paper, key, detailed] = await Promise.all([validPDF(form.get("paper")), validPDF(keyInput), validPDF(form.get("detailed"))]);
  if (!paper || (fileProvided(keyInput) && !key)) return { error: "Select valid paper and answer key PDFs up to 10 MB each." };
  if (!detailed) return { error: "Attach the PDF containing both the answer key and detailed explanations (up to 10 MB)." };
  const id = crypto.randomUUID();
  const directory = join(storageRoot(), id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    for (const [name, file] of [["paper.pdf", paper], ["key.pdf", key], ["detailed.pdf", detailed]] as const) {
      if (!file) continue;
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
    await db.transaction(async (tx) => {
      await tx.insert(imports).values({ id, ...meta.data, paperName: paper.name.slice(0, 255), keyName: key?.name.slice(0, 255) ?? "" });
      await tx.insert(editorialEvents).values({ importId: id, type: "Uploaded",
        detail: "Queued the question paper and the detailed answer PDF." });
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "import.queue_failed", id, reason: error instanceof Error ? error.name : "unknown" }));
    return { error: "The import could not be queued. Open PDF imports to check its status before uploading again." };
  }
  revalidatePath("/admin/imports");
  redirect(`/admin/imports/${id}`);
}

export async function saveDraft(importId: string, id: string, generation: number, _previous: FormStatus, form: FormData): Promise<FormStatus> {
  await requireAdmin();
  if (!z.uuid().safeParse(importId).success || !z.uuid().safeParse(id).success) return { error: "Draft unavailable." };
  const metadata = z.object({
    subject: z.string().trim().min(1).max(60),
    topic: z.string().trim().min(1).max(80),
    difficulty: z.enum(["Unrated", "Easy", "Medium", "Hard"]),
    tags: z.array(z.string().trim().min(1).max(40)).max(12),
  }).safeParse({
    subject: form.get("subject"), topic: form.get("topic"), difficulty: form.get("difficulty"),
    tags: String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
  });
  if (!metadata.success) return { error: "Check the subject, topic, difficulty, and tags." };
  let rawOptions: unknown;
  try { rawOptions = JSON.parse(String(form.get("options"))); }
  catch { return { error: "The answer options could not be read." }; }
  const optionInputs = z.array(optionSchema).max(12).safeParse(rawOptions);
  if (!optionInputs.success) return { error: "Every option needs a label and answer text." };
  const result = await db.transaction(async (tx) => {
    const [draft] = await tx.select().from(drafts).where(and(eq(drafts.id, id), eq(drafts.importId, importId))).for("update");
    if (!draft) return { error: "Draft unavailable." };
    if (draft.generation !== generation) return { error: "This draft changed in another edit. Reload before saving." };
    const sourceImages = new Map(draft.content.options.map((option) => [option.id,
      new Set(option.blocks?.filter((block) => block.type === "source_crop").map((block) => `${block.page}:${block.file}`)),
    ]));
    if (optionInputs.data.some((option) => option.blocks?.some((block) => block.type === "source_crop" && !sourceImages.get(option.id)?.has(`${block.page}:${block.file}`)))) {
      return { error: "Option images must come from the corresponding source option." };
    }
    const interaction = form.get("interaction") ?? draft.content.interaction;
    const written = typeof interaction === "string" && isWritten(interaction);
    const ranked = typeof interaction === "string" && isRanked(interaction);
    const answers = form.getAll(written ? "written-answer" : "answer");
    const sequence = ranked ? String(form.get("sequence") ?? "").split(",").map((label) =>
      optionInputs.data.find((option) => option.label.toLowerCase() === label.trim().toLowerCase())?.id ?? ""
    ) : [];
    const answer = ranked ? sequence : interaction === "multiple_choice" ? answers : answers[0] || null;
    let blocks: unknown;
    try { blocks = JSON.parse(String(form.get("blocks"))); }
    catch { return { error: "The question blocks could not be read." }; }
    const content = questionSchema.safeParse({
      ...draft.content,
      blocks,
      options: optionInputs.data,
      interaction,
      presentation: (form.get("presentation") ?? draft.content.presentation) || undefined,
      answer,
      prompts: interaction === "pair_matching" ? String(form.get("prompts") ?? "").split("\n").map((line) => line.trim()).filter(Boolean) : undefined,
      explanation: form.get("explanation"),
    });
    if (!content.success) return { error: "Check question text, image descriptions, merged cells, and answer options." };
    const originalAnswer = choiceIds(draft.original.answer);
    const savedAnswer = choiceIds(content.data.answer);
    if (originalAnswer.length > 0 && originalAnswer.length === savedAnswer.length &&
      originalAnswer.every((id) => savedAnswer.includes(id))) {
      content.data.explanationCrops = draft.original.explanationCrops;
    } else {
      delete content.data.explanationCrops;
    }
    const sourceCrops = new Set(draft.content.blocks.filter((block) => block.type === "source_crop").map((block) => `${block.page}:${block.file}`));
    if (content.data.blocks.some((block) => block.type === "source_crop" && !sourceCrops.has(`${block.page}:${block.file}`))) {
      return { error: "Source crops must belong to this question." };
    }
    const issues = form.get("save-mode") !== "automatic" && form.get("verified") === "on" ? [] : draft.issues;
    await tx.update(drafts).set({ ...metadata.data, tags: [...new Set(metadata.data.tags)], content: content.data, issues,
      generation: draft.generation + 1, editedAt: new Date() }).where(eq(drafts.id, id));
    await tx.insert(editorialEvents).values({ importId, questionNumber: draft.number, type: "Draft saved",
      detail: issues.length < draft.issues.length ? "Saved changes and confirmed source verification." : "Saved changes for publication review." });
    return { saved: true };
  });
  revalidatePath(`/admin/imports/${importId}`);
  return result;
}

export async function publishImport(id: string, form: FormData) {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return;
  const scope = form.get("scope");
  const selection = z.array(z.uuid()).max(1000).safeParse(form.getAll("draft"));
  if (!selection.success || (scope === "selected" && !selection.data.length)) redirect(`/admin/imports/${id}?mode=publish`);
  const selected = selection.data;
  const published = await db.transaction(async (tx) => {
    const [paper] = await tx.select().from(imports).where(and(eq(imports.id, id), eq(imports.status, "ready"))).for("no key update");
    if (!paper) return 0;
    const rows = await tx.select().from(drafts).where(and(eq(drafts.importId, id), selected.length ? inArray(drafts.id, selected) : undefined))
      .orderBy(drafts.number).for("update");
    const existing = await tx.select().from(questions).where(eq(questions.importId, id));
    const byDraft = new Map(existing.map((row) => [row.draftId, row]));
    let count = 0;
    for (const draft of rows) {
      const content = questionSchema.safeParse(draft.content);
      const current = byDraft.get(draft.id);
      if (!content.success || draft.issues.length || publicationIssues(content.data).length ||
          (current && (current.archivedAt || current.draftGeneration === draft.generation))) continue;
      const subject = draft.subject ?? paper.subject;
      const topic = draft.topic ?? "General";
      const difficulty = draft.difficulty ?? "Unrated";
      const revision = (current?.revision ?? 0) + 1;
      const snapshot = { revision, content: content.data, subject, topic, difficulty, tags: draft.tags };
      const projection = { ...snapshot, draftGeneration: draft.generation,
        searchText: [displayText(content.data), subject, topic, draft.tags.join(" "), paper.title].join("\n") };
      let questionId = current?.id;
      if (questionId) await tx.update(questions).set(projection).where(eq(questions.id, questionId));
      else {
        const [question] = await tx.insert(questions).values({ ...projection,
          draftId: draft.id, importId: id, slug: `${id}-${draft.number}`, source: paper.title, number: draft.number })
          .returning({ id: questions.id });
        questionId = question.id;
      }
      await tx.insert(questionVersions).values({ ...snapshot, questionId });
      await tx.insert(editorialEvents).values({ importId: id, questionNumber: draft.number, type: "Published", detail: `Published revision ${revision}.` });
      count++;
    }
    return count;
  });
  revalidatePath("/", "layout");
  redirect(`/admin/imports/${id}?published=${published}`);
}

export async function restoreRevision(importId: string, draftId: string, revision: number, generation: number) {
  await requireAdmin();
  if (![importId, draftId].every((value) => z.uuid().safeParse(value).success) || !z.number().int().positive().safeParse(revision).success) return;
  const restored = await db.transaction(async (tx) => {
    const [draft] = await tx.select().from(drafts).where(and(eq(drafts.id, draftId), eq(drafts.importId, importId))).for("update");
    if (!draft || draft.generation !== generation) return null;
    const [version] = await tx.select().from(questionVersions).innerJoin(questions, eq(questionVersions.questionId, questions.id))
      .where(and(eq(questions.draftId, draftId), eq(questionVersions.revision, revision)));
    if (!version) return null;
    const { content, subject, topic, difficulty, tags } = version.question_versions;
    await tx.update(drafts).set({ content, subject, topic, difficulty, tags, issues: [], generation: draft.generation + 1, editedAt: new Date() }).where(eq(drafts.id, draftId));
    await tx.insert(editorialEvents).values({ importId, questionNumber: draft.number, type: "Revision restored",
      detail: `Copied revision ${revision} into the draft.` });
    return draft.number;
  });
  if (restored === null) redirect(`/admin/imports/${importId}?mode=history&stale=1`);
  revalidatePath(`/admin/imports/${importId}`);
  redirect(`/admin/imports/${importId}?mode=edit&q=${restored}`);
}

export async function setArchived(importId: string, draftId: string, archived: boolean) {
  await requireAdmin();
  if (![importId, draftId].every((value) => z.uuid().safeParse(value).success) || typeof archived !== "boolean") return;
  await db.transaction(async (tx) => {
    const [draft] = await tx.select().from(drafts).where(and(eq(drafts.id, draftId), eq(drafts.importId, importId))).for("update");
    if (!draft) return;
    const updated = await tx.update(questions).set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(questions.draftId, draftId), archived ? sql`${questions.archivedAt} is null` : sql`${questions.archivedAt} is not null`))
      .returning({ id: questions.id });
    if (updated.length) await tx.insert(editorialEvents).values({ importId, questionNumber: draft.number,
      type: archived ? "Archived" : "Unarchived", detail: archived ? "Removed from the active student bank." : "Returned the published revision to the student bank." });
  });
  revalidatePath("/", "layout");
}

export async function retryImport(importId: string) {
  await requireAdmin();
  if (!z.uuid().safeParse(importId).success) return;
  await db.transaction(async (tx) => {
    const [retried] = await tx.update(imports).set({ status: "queued", stage: "Waiting for worker", error: null,
      attempts: 0, claimToken: null, leaseUntil: null }).where(and(eq(imports.id, importId), eq(imports.status, "failed"),
        sql`not exists (select 1 from ${drafts} where ${drafts.importId} = ${importId})`)).returning({ id: imports.id });
    if (retried) await tx.insert(editorialEvents).values({ importId, type: "Retry queued", detail: "Reused the stored question paper and answer key." });
  });
  revalidatePath(`/admin/imports/${importId}`);
}

export async function deleteImport(importId: string): Promise<{ error?: string; filesRetained?: boolean }> {
  await requireAdmin();
  if (!z.uuid().safeParse(importId).success) return { error: "Import unavailable." };
  const result = await db.transaction(async (tx) => {
    const [paper] = await tx.select({ status: imports.status }).from(imports)
      .where(eq(imports.id, importId)).for("no key update");
    if (!paper) return { error: "Import unavailable." };
    if (paper.status === "processing") return { error: "Wait for processing to finish before deleting this import." };
    if (await tx.$count(questions, eq(questions.importId, importId))) {
      return { error: "This import has published questions and is retained for study history." };
    }
    await tx.delete(editorialEvents).where(eq(editorialEvents.importId, importId));
    await tx.delete(drafts).where(eq(drafts.importId, importId));
    await tx.delete(imports).where(eq(imports.id, importId));
    return {};
  });
  if (result.error) return result;

  let filesRetained = false;
  try {
    await rm(join(storageRoot(), importId), { recursive: true, force: true, maxRetries: 2 });
  } catch (error) {
    filesRetained = true;
    console.error(JSON.stringify({ event: "import.cleanup_failed", importId, reason: error instanceof Error ? error.name : "unknown" }));
  }
  revalidatePath("/admin", "layout");
  return { filesRetained };
}

export async function restoreOriginal(importId: string, draftId: string, generation: number) {
  await requireAdmin();
  if (![importId, draftId].every((id) => z.uuid().safeParse(id).success)) return;
  const restored = await db.transaction(async (tx) => {
    const [draft] = await tx.select().from(drafts).where(and(eq(drafts.id, draftId), eq(drafts.importId, importId))).for("update");
    if (!draft || draft.generation !== generation) return null;
    await tx.update(drafts).set({ content: draft.original,
      issues: draft.page > 0 ? ["Verify the restored extraction against the source before publishing."] : [],
      generation: generation + 1, editedAt: new Date() }).where(eq(drafts.id, draft.id));
    await tx.insert(editorialEvents).values({ importId, questionNumber: draft.number, type: "Source restored", detail: "Copied the original content into the draft." });
    return draft.number;
  });
  if (restored === null) redirect(`/admin/imports/${importId}?mode=history&stale=1`);
  revalidatePath(`/admin/imports/${importId}`);
  redirect(`/admin/imports/${importId}?mode=edit&q=${restored}`);
}
