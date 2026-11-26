"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { db } from "@/database";
import { attempts, practiceSessions, questions, questionVersions } from "@/database/schema";
import { activeSession, matchVersion, versionLookup } from "@/modules/practice";
import { activeQuestion, getProfile } from "@/modules/study";
import { gradeResponse } from "@/lib/practice-scoring";
import { isRanked } from "@/lib/ranked-answer";
import { validSelection } from "@/lib/content";
import { gradeWritten, isWritten, normalizeWritten } from "@/lib/written-answer";

export type PracticeAction = { error?: string; saved?: boolean };

const settingsSchema = z.object({
  source: z.string().max(120),
  minutes: z.coerce.number().int().min(1).max(180),
  marks: z.coerce.number().int().min(1).max(10),
  penalty: z.enum(["third", "none"]),
});

export async function startPractice(_previous: PracticeAction, form: FormData): Promise<PracticeAction> {
  const settings = settingsSchema.safeParse({ source: form.get("source"), minutes: form.get("minutes"), marks: form.get("marks"), penalty: form.get("penalty") });
  if (!settings.success) return { error: "Choose a paper and enter a valid duration and scoring rule." };
  const profileId = (await getProfile(true))!;
  const current = await activeSession(profileId);
  if (current) redirect(`/practice/${current.id}?q=1`);
  const { source, minutes, marks, penalty } = settings.data;
  const manifest = await db.select({ id: questions.id, revision: questions.revision }).from(questions)
    .where(and(activeQuestion, sql`${questions.content}->>'interaction' <> 'descriptive'`, source ? eq(questions.source, source) : undefined))
    .orderBy(questions.source, questions.number, questions.id).limit(501);
  if (!manifest.length) return { error: "There are no published questions for this paper." };
  if (manifest.length > 500) return { error: "Choose one paper with 500 or fewer questions." };
  const [session] = await db.insert(practiceSessions).values({
    profileId, manifest, endsAt: new Date(Date.now() + minutes * 60_000),
    correctPoints: marks * 3, wrongPoints: penalty === "third" ? marks : 0,
  }).onConflictDoNothing().returning({ id: practiceSessions.id });
  const id = session?.id ?? (await activeSession(profileId))?.id;
  if (!id) return { error: "Could not start the test. Try again." };
  redirect(`/practice/${id}?q=1`);
}

export async function saveResponse(id: string, questionId: string, _state: PracticeAction, form: FormData): Promise<PracticeAction> {
  const profileId = await getProfile();
  if (!profileId || !z.uuid().safeParse(id).success || !z.uuid().safeParse(questionId).success) return { error: "This test is unavailable." };
  const result = await db.transaction(async (tx) => {
    const [session] = await tx.select().from(practiceSessions).where(and(eq(practiceSessions.id, id), eq(practiceSessions.profileId, profileId))).for("update");
    if (!session || session.submittedAt || session.endsAt.getTime() <= Date.now()) return { error: "This test has ended." };
    const pinned = session.manifest.find((entry) => entry.id === questionId);
    if (!pinned) return { error: "This question does not belong to the test." };
    const response = { ...session.responses[questionId] };
    const selection = form.get("selection");
    if (selection === "multiple" || selection === "clear" || (form.has("option") && !form.has("mark"))) {
      const [version] = await tx.select({ content: questionVersions.content }).from(questionVersions)
        .where(and(eq(questionVersions.questionId, questionId), eq(questionVersions.revision, pinned.revision)));
      const submitted = form.getAll("option");
      const values = selection === "clear" || (submitted.length === 1 && submitted[0] === "") ? [] : submitted;
      if (version && isWritten(version.content.interaction)) {
        const input = z.string().trim().min(1).max(8000).safeParse(values[0]);
        if (values.length && (!input.success || values.length > 1 || !normalizeWritten(version.content.interaction, input.data))) {
          return { error: "Enter a valid response before saving." };
        }
        response.option = input.success ? input.data : undefined;
        response.options = undefined;
      } else {
        const ids = version && validSelection(version.content, values);
        if (!ids) return { error: "Complete the response using valid, distinct options." };
        const interaction = version.content.interaction;
        const multiple = interaction === "multiple_choice" || isRanked(interaction);
        response.option = multiple ? undefined : ids[0];
        response.options = multiple && ids.length ? ids : undefined;
      }
    }
    if (form.get("mark") === "toggle") response.marked = !response.marked;
    await tx.update(practiceSessions).set({ responses: { ...session.responses, [questionId]: response } }).where(eq(practiceSessions.id, id));
    return { saved: true };
  });
  if (result.saved) revalidatePath(`/practice/${id}`);
  return result;
}

export async function finishPractice(id: string) {
  const profileId = await getProfile();
  if (!profileId || !z.uuid().safeParse(id).success) return;
  await db.transaction(async (tx) => {
    const [session] = await tx.select().from(practiceSessions).where(and(eq(practiceSessions.id, id), eq(practiceSessions.profileId, profileId))).for("update");
    if (!session || session.submittedAt) return;
    const versions = await tx.select().from(questionVersions).where(versionLookup(session.manifest));
    const recorded = session.manifest.flatMap((entry) => {
      const { option, options } = session.responses[entry.id] ?? {};
      const version = matchVersion(versions, entry);
      if (!version) return [];
      const { answer, interaction } = version.content;
      const written = isWritten(interaction);
      const correct = gradeResponse({ answer, selected: options ?? option, interaction });
      if (correct === null) return [];
      return [{ profileId, questionId: entry.id, revision: entry.revision, optionId: written ? null : option ?? null, optionIds: options ?? null,
        responseText: written ? option ?? null : null, sessionId: id, mode: "practice" as const, correct }];
    });
    if (recorded.length) await tx.insert(attempts).values(recorded);
    await tx.update(practiceSessions).set({ submittedAt: new Date() }).where(eq(practiceSessions.id, id));
  });
  revalidatePath("/");
  revalidatePath("/progress");
  revalidatePath("/practice");
  revalidatePath("/revision");
  redirect(`/practice/${id}`, RedirectType.replace);
}

export async function deleteTestReview(id: string) {
  const profileId = await getProfile();
  if (!profileId || !z.uuid().safeParse(id).success) return;
  await db.transaction(async (tx) => {
    const predicate = and(eq(practiceSessions.id, id), eq(practiceSessions.profileId, profileId), isNotNull(practiceSessions.submittedAt));
    const [session] = await tx.select({ id: practiceSessions.id }).from(practiceSessions).where(predicate).for("update");
    if (!session) return;
    await tx.update(attempts).set({ sessionId: null }).where(and(eq(attempts.sessionId, id), eq(attempts.profileId, profileId)));
    await tx.delete(practiceSessions).where(predicate);
  });
  revalidatePath("/practice");
  revalidatePath("/progress");
  revalidatePath("/revision");
}
