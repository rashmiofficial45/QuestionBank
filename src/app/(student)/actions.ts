"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/database";
import { attempts, bookmarks, practiceSessions, questions, questionVersions, studyDrills, studyNotes, studyRevision } from "@/database/schema";
import { activeQuestion, getProfile } from "@/modules/study";
import { checkSubmission, type AnswerResult } from "@/lib/submit-answer";

export type AnswerState = AnswerResult;

export async function submitAnswer(questionId: string, revision: number, mode: "practice" | "bank", _previous: AnswerState, form: FormData): Promise<AnswerState> {
  const values = form.getAll("option");
  if (!z.uuid().safeParse(questionId).success || !values.length || !z.number().int().positive().safeParse(revision).success || (mode !== "practice" && mode !== "bank")) return { error: "Choose an answer before checking." };
  const [question] = await db.select({ content: questionVersions.content }).from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .where(and(eq(questions.id, questionId), eq(questionVersions.revision, revision), activeQuestion));
  if (!question) return { error: "This option is unavailable. Reload the question and try again." };
  const { result, attempt } = checkSubmission(question.content, values);
  if (attempt) {
    const profileId = (await getProfile(true))!;
    await db.insert(attempts).values({ profileId, questionId, revision, mode, ...attempt });
    revalidatePath("/");
    revalidatePath("/progress");
    revalidatePath("/revision");
  }
  return result;
}

export async function markRevision(questionId: string, marked: boolean) {
  if (!z.uuid().safeParse(questionId).success || typeof marked !== "boolean") return;
  const [question] = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.id, questionId), activeQuestion));
  if (!question) return;
  const profileId = await getProfile(marked);
  if (!profileId) return;
  if (marked) await db.insert(studyRevision).values({ profileId, questionId }).onConflictDoNothing();
  else await db.delete(studyRevision).where(and(eq(studyRevision.profileId, profileId), eq(studyRevision.questionId, questionId)));
  revalidatePath("/", "layout");
}

export async function setBookmark(questionId: string, selected: boolean) {
  if (!z.uuid().safeParse(questionId).success) return;
  const profileId = (await getProfile(true))!;
  if (selected) await db.insert(bookmarks).values({ profileId, questionId }).onConflictDoNothing();
  else await db.delete(bookmarks).where(and(eq(bookmarks.profileId, profileId), eq(bookmarks.questionId, questionId)));
  revalidatePath("/bookmarks");
  revalidatePath("/", "layout");
}

type NoteState = { saved?: boolean; error?: string };

export async function saveNote(questionId: string, _state: NoteState, form: FormData): Promise<NoteState> {
  const note = z.string().trim().max(4000).safeParse(form.get("note"));
  if (!note.success || !z.uuid().safeParse(questionId).success) return { error: "Use up to 4,000 characters." };
  const [question] = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.id, questionId), activeQuestion));
  if (!question) return { error: "This question is unavailable." };
  const profileId = await getProfile(Boolean(note.data));
  if (profileId && note.data) await db.insert(studyNotes).values({ profileId, questionId, text: note.data })
    .onConflictDoUpdate({ target: [studyNotes.profileId, studyNotes.questionId], set: { text: note.data } });
  if (profileId && !note.data) await db.delete(studyNotes).where(and(eq(studyNotes.profileId, profileId), eq(studyNotes.questionId, questionId)));
  return { saved: true };
}

export async function resetProgress() {
  const profileId = await getProfile();
  if (!profileId) return;
  await db.transaction(async (tx) => {
    await tx.select({ id: practiceSessions.id }).from(practiceSessions).where(eq(practiceSessions.profileId, profileId)).for("update");
    await tx.select({ id: studyDrills.id }).from(studyDrills).where(eq(studyDrills.profileId, profileId)).for("update");
    await tx.delete(studyDrills).where(eq(studyDrills.profileId, profileId));
    await tx.delete(studyRevision).where(eq(studyRevision.profileId, profileId));
    await tx.delete(attempts).where(eq(attempts.profileId, profileId));
    await tx.delete(practiceSessions).where(eq(practiceSessions.profileId, profileId));
    await tx.delete(bookmarks).where(eq(bookmarks.profileId, profileId));
    await tx.delete(studyNotes).where(eq(studyNotes.profileId, profileId));
  });
  revalidatePath("/", "layout");
}
