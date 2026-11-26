"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/database";
import { attempts, bookmarks, practiceSessions, questions, questionVersions, studyNotes } from "@/database/schema";
import { activeQuestion, getProfile } from "@/modules/study";
import type { ChoiceSelection } from "@/lib/choice-selection";
import { gradeResponse } from "@/lib/practice-scoring";
import { isRanked } from "@/lib/ranked-answer";
import { validSelection } from "@/lib/content";
import { gradeWritten, isWritten, normalizeWritten } from "@/lib/written-answer";

export type AnswerState = { correct?: boolean; selected?: ChoiceSelection; answer?: ChoiceSelection; explanation?: string; error?: string };

export async function submitAnswer(questionId: string, revision: number, mode: "practice" | "bank", _previous: AnswerState, form: FormData): Promise<AnswerState> {
  const values = form.getAll("option");
  if (!z.uuid().safeParse(questionId).success || !values.length || !z.number().int().positive().safeParse(revision).success || (mode !== "practice" && mode !== "bank")) return { error: "Choose an answer before checking." };
  const [question] = await db.select({ content: questionVersions.content }).from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .where(and(eq(questions.id, questionId), eq(questionVersions.revision, revision), activeQuestion));
  if (question && isWritten(question.content.interaction)) {
    const { answer, interaction, explanation } = question.content;
    const input = z.string().trim().min(1).max(8000).safeParse(values[0]);
    if (!input.success || values.length !== 1 || typeof answer !== "string" || !normalizeWritten(interaction, input.data)) {
      return { error: interaction === "numeric" ? "Enter a valid decimal answer." : "Enter a response before reviewing." };
    }
    if (interaction === "descriptive") return { answer, selected: input.data, explanation };
    const correct = gradeWritten(interaction, answer, input.data) === true;
    const profileId = (await getProfile(true))!;
    await db.insert(attempts).values({ profileId, questionId, revision, responseText: input.data, correct, mode });
    revalidatePath("/");
    revalidatePath("/progress");
    revalidatePath("/revision");
    return { answer, selected: input.data, correct, explanation };
  }
  const selected = question && validSelection(question.content, values);
  if (!question?.content.answer || !selected?.length) {
    return { error: "This option is unavailable. Reload the question and try again." };
  }
  const profileId = (await getProfile(true))!;
  const interaction = question.content.interaction;
  const multiple = interaction === "multiple_choice" || isRanked(interaction);
  const correct = gradeResponse({ answer: question.content.answer, selected, interaction }) === true;
  await db.insert(attempts).values({ profileId, questionId, optionId: multiple ? null : selected[0], optionIds: multiple ? selected : null, revision, correct, mode });
  revalidatePath("/");
  revalidatePath("/progress");
  revalidatePath("/revision");
  return { correct, selected, answer: question.content.answer, explanation: question.content.explanation };
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
    await tx.delete(attempts).where(eq(attempts.profileId, profileId));
    await tx.delete(practiceSessions).where(eq(practiceSessions.profileId, profileId));
    await tx.delete(bookmarks).where(eq(bookmarks.profileId, profileId));
    await tx.delete(studyNotes).where(eq(studyNotes.profileId, profileId));
  });
  revalidatePath("/", "layout");
}
