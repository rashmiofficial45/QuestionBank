"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/database";
import { attempts, bookmarks, practiceSessions, questions, questionVersions } from "@/database/schema";
import { activeQuestion, getProfile } from "@/modules/study";
import { gradeSelection, type ChoiceSelection } from "@/lib/choice-selection";
import { validSelection } from "@/lib/content";

export type AnswerState = { correct?: boolean; selected?: ChoiceSelection; answer?: ChoiceSelection; explanation?: string; error?: string };

export async function submitAnswer(questionId: string, revision: number, mode: "practice" | "bank", _previous: AnswerState, form: FormData): Promise<AnswerState> {
  const values = form.getAll("option");
  if (!z.uuid().safeParse(questionId).success || !values.length || !z.number().int().positive().safeParse(revision).success || (mode !== "practice" && mode !== "bank")) return { error: "Choose an answer before checking." };
  const [question] = await db.select({ content: questionVersions.content }).from(questionVersions)
    .innerJoin(questions, eq(questionVersions.questionId, questions.id))
    .where(and(eq(questions.id, questionId), eq(questionVersions.revision, revision), activeQuestion));
  const selected = question && validSelection(question.content, values);
  if (!question?.content.answer || !selected?.length) {
    return { error: "This option is unavailable. Reload the question and try again." };
  }
  const profileId = (await getProfile(true))!;
  const multiple = question.content.interaction === "multiple_choice";
  const correct = gradeSelection(question.content.answer, selected) === true;
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

export async function resetProgress() {
  const profileId = await getProfile();
  if (!profileId) return;
  await db.transaction(async (tx) => {
    await tx.select({ id: practiceSessions.id }).from(practiceSessions).where(eq(practiceSessions.profileId, profileId)).for("update");
    await tx.delete(attempts).where(eq(attempts.profileId, profileId));
    await tx.delete(practiceSessions).where(eq(practiceSessions.profileId, profileId));
    await tx.delete(bookmarks).where(eq(bookmarks.profileId, profileId));
  });
  revalidatePath("/", "layout");
}
