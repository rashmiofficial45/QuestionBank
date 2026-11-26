"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/database";
import { attempts, questions, questionVersions, studyDrills } from "@/database/schema";
import { checkSubmission, type AnswerResult } from "@/lib/submit-answer";
import { activeQuestion, getProfile } from "@/modules/study";

export async function startDrill(_state: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const input = z.object({
    subject: z.string().max(60), topic: z.string().max(80), difficulty: z.enum(["", "Easy", "Medium", "Hard", "Unrated"]),
    count: z.coerce.number().int().min(1).max(50),
  }).safeParse({ subject: form.get("subject"), topic: form.get("topic"), difficulty: form.get("difficulty"), count: form.get("count") });
  if (!input.success) return { error: "Check your practice filters and question count." };
  const filter = input.data;
  const manifest = await db.select({ id: questions.id, revision: questions.revision }).from(questions)
    .where(and(activeQuestion, filter.subject ? eq(questions.subject, filter.subject) : undefined,
      filter.topic ? eq(questions.topic, filter.topic) : undefined,
      filter.difficulty ? eq(questions.difficulty, filter.difficulty) : undefined))
    .orderBy(questions.source, questions.number, questions.id).limit(filter.count);
  if (!manifest.length) return { error: "No published questions match these filters." };
  const profileId = (await getProfile(true))!;
  const [drill] = await db.insert(studyDrills).values({ profileId, manifest }).returning({ id: studyDrills.id });
  redirect(`/practice/drill/${drill.id}?q=1`);
}

export async function answerDrill(id: string, questionId: string, _state: AnswerResult, form: FormData): Promise<AnswerResult> {
  const profileId = await getProfile();
  if (!profileId || ![id, questionId].every((value) => z.uuid().safeParse(value).success)) return { error: "Practice session unavailable." };
  const result = await db.transaction(async (tx) => {
    const [drill] = await tx.select().from(studyDrills).where(and(eq(studyDrills.id, id), eq(studyDrills.profileId, profileId))).for("update");
    const question = drill?.manifest.find((item) => item.id === questionId);
    if (!question || drill.submittedAt) return { error: "Practice session unavailable." };
    const [version] = await tx.select().from(questionVersions).where(and(eq(questionVersions.questionId, questionId), eq(questionVersions.revision, question.revision)));
    if (!version) return { error: "This question is unavailable." };
    const previous = drill.responses[questionId];
    if (previous?.answered) return { selected: previous.selected, correct: previous.correct, answer: version.content.answer ?? undefined, explanation: version.content.explanation, explanationCrops: version.content.explanationCrops };
    const { result, attempt } = checkSubmission(version.content, form.getAll("option"));
    if (result.error) return result;
    await tx.update(studyDrills).set({ responses: {
      ...drill.responses, [questionId]: { answered: true, correct: result.correct, selected: result.selected },
    } }).where(eq(studyDrills.id, id));
    if (attempt) await tx.insert(attempts).values({ ...attempt, questionId, profileId, revision: version.revision, mode: "practice" });
    return result;
  });
  revalidatePath("/progress");
  revalidatePath("/revision");
  return result;
}

export async function finishDrill(id: string) {
  const profileId = await getProfile();
  if (!profileId || !z.uuid().safeParse(id).success) return;
  await db.update(studyDrills).set({ submittedAt: new Date() }).where(and(eq(studyDrills.id, id), eq(studyDrills.profileId, profileId), isNull(studyDrills.submittedAt)));
  redirect(`/practice/drill/${id}`);
}
