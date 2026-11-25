"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/database";
import { attempts, bookmarks, questions } from "@/database/schema";
import { getProfile } from "@/modules/study";

export type AnswerState = { correct?: boolean; answer?: string; explanation?: string; error?: string };

export async function submitAnswer(questionId: string, _previous: AnswerState, form: FormData): Promise<AnswerState> {
  const choice = z.string().max(64).safeParse(form.get("option"));
  if (!z.uuid().safeParse(questionId).success || !choice.success) return { error: "Choose an answer before checking." };
  const [question] = await db.select().from(questions).where(eq(questions.id, questionId));
  if (!question?.content.answer || !question.content.options.some((option) => option.id === choice.data)) {
    return { error: "This option is unavailable. Reload the question and try again." };
  }
  const profileId = (await getProfile(true))!;
  const correct = question.content.answer === choice.data;
  await db.insert(attempts).values({ profileId, questionId, optionId: choice.data, correct });
  revalidatePath("/");
  revalidatePath("/progress");
  return { correct, answer: question.content.answer, explanation: question.content.explanation };
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
    await tx.delete(attempts).where(eq(attempts.profileId, profileId));
    await tx.delete(bookmarks).where(eq(bookmarks.profileId, profileId));
  });
  revalidatePath("/", "layout");
}
