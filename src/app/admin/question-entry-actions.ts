"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/database";
import { drafts, editorialEvents, imports } from "@/database/schema";
import { parseQuestionTransfer, type TransferQuestion } from "@/lib/question-transfer";
import { requireAdmin } from "@/modules/imports";

const sourceMetadata = z.object({ title: z.string().trim().min(1).max(120), subject: z.string().trim().min(1).max(60) });
type Result = { error?: string };

async function stageQuestions(meta: z.infer<typeof sourceMetadata>, name: string, entries: TransferQuestion[]) {
  const id = await db.transaction(async (tx) => {
    const [paper] = await tx.insert(imports).values({ ...meta, paperName: name, keyName: "", status: "ready", stage: "Drafts ready" }).returning({ id: imports.id });
    await tx.insert(drafts).values(entries.map(({ content, ...fields }) => ({
      ...fields, importId: paper.id, page: 0, content, original: content,
    })));
    await tx.insert(editorialEvents).values({ importId: paper.id, type: "Drafts added", detail: `Staged ${entries.length} question drafts from ${name}.` });
    return paper.id;
  });
  revalidatePath("/admin/imports");
  return id;
}

export async function createQuestion(_previous: Result, form: FormData): Promise<Result> {
  await requireAdmin();
  const meta = sourceMetadata.safeParse({ title: form.get("title"), subject: form.get("subject") });
  const text = z.string().trim().min(1).max(16000).safeParse(form.get("question"));
  if (!meta.success || !text.success) return { error: "Enter a source title, subject, and question text." };
  const id = await stageQuestions(meta.data, "Manual entry", [{ number: 1, subject: meta.data.subject, topic: "General", difficulty: "Unrated", tags: [],
    content: { version: 1, interaction: "single_choice", blocks: [{ id: "stem", type: "paragraph", text: text.data }], options: [], answer: null, explanation: "" },
  }]);
  redirect(`/admin/imports/${id}?mode=edit&q=1`);
}

export async function uploadQuestionData(_previous: Result, form: FormData): Promise<Result> {
  await requireAdmin();
  const meta = sourceMetadata.safeParse({ title: form.get("title"), subject: form.get("subject") });
  if (!meta.success) return { error: "Enter a source title and subject." };
  const file = form.get("data");
  const extension = file instanceof File ? /\.(csv|json)$/i.exec(file.name)?.[1].toLowerCase() : undefined;
  if (!(file instanceof File) || (extension !== "csv" && extension !== "json") || !file.size || file.size > 5 * 1024 * 1024) {
    return { error: "Select a CSV or JSON file up to 5 MB." };
  }
  let entries;
  try {
    entries = parseQuestionTransfer(await file.text(), extension, meta.data.subject);
  } catch (error) {
    if (error instanceof SyntaxError) return { error: "The file contains malformed JSON." };
    if (error instanceof z.ZodError) return { error: "Provide an array of 1–1,000 question records." };
    return { error: error instanceof Error ? error.message : "The question file could not be read." };
  }
  const id = await stageQuestions(meta.data, extension.toUpperCase() + " import", entries);
  redirect(`/admin/imports/${id}`);
}
