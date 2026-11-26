"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/database";
import { drafts, editorialEvents, imports, questions, questionVersions } from "@/database/schema";
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
  const optional = form.get("explanations");
  const [paper, key, explanations] = await Promise.all([validPDF(form.get("paper")), validPDF(keyInput), validPDF(optional)]);
  if (!paper || (fileProvided(keyInput) && !key)) return { error: "Select valid paper and answer key PDFs up to 10 MB each." };
  if (fileProvided(optional) && !explanations) return { error: "Select an explanation PDF up to 10 MB, or leave it empty." };
  const id = crypto.randomUUID();
  const directory = join(storageRoot(), id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    for (const [name, file] of [["paper.pdf", paper], ["key.pdf", key], ["explanations.pdf", explanations]] as const) {
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
        detail: `Queued ${key ? "the question paper and separate answer key" : "the combined question and answer PDF"}${explanations ? " with explanations" : ""}.` });
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
    const content = questionSchema.safeParse({
      ...draft.content,
      blocks: draft.content.blocks.map((block) => {
        if (block.type === "paragraph") return {
          ...block, text: form.get(`stem-${block.id}`),
          style: (form.get(`style-${block.id}`) ?? block.style) || undefined,
        };
        if (block.type === "assertion_reason") return {
          ...block,
          assertion: { ...block.assertion, text: form.get(`assertion-${block.id}`) },
          reason: { ...block.reason, text: form.get(`reason-${block.id}`) },
        };
        if (block.type === "statements") return { ...block, items: block.items.map((item, position) => ({
          ...item, text: form.get(`statement-${block.id}-${position}`),
        })) };
        if (block.type !== "table") return block;
        return { ...block,
          headers: block.headers.map((_, col) => form.get(`cell-${block.id}-header-${col}`)),
          rows: block.rows.map((row, index) => row.map((_, col) => form.get(`cell-${block.id}-${index}-${col}`))),
        };
      }),
      options: optionInputs.data,
      interaction,
      presentation: (form.get("presentation") ?? draft.content.presentation) || undefined,
      answer: ranked ? sequence : interaction === "multiple_choice" ? answers : answers[0] || null,
      prompts: interaction === "pair_matching" ? String(form.get("prompts") ?? "").split("\n").map((line) => line.trim()).filter(Boolean) : undefined,
      explanation: form.get("explanation"),
    });
    if (!content.success) return { error: "Provide question text and a value for every option." };
    if (draft.content.blocks.some((block) => block.type === "source_crop" && !block.reference) && JSON.stringify(content.data.blocks) !== JSON.stringify(questionSchema.parse(draft.content).blocks)) {
      return { error: "This prompt includes a source image. Its text stays linked to that image in this preview." };
    }
    const issues = form.get("verified") === "on" ? [] : draft.issues;
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
