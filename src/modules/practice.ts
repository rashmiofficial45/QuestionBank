import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { scoreCounts } from "@/lib/practice-scoring";
import { db } from "@/database";
import { attempts, practiceSessions, questions, questionVersions, type TestQuestion } from "@/database/schema";

export function activeSession(profileId: string) {
  return db.select().from(practiceSessions).where(and(eq(practiceSessions.profileId, profileId), isNull(practiceSessions.submittedAt))).limit(1)
    .then(([session]) => session);
}

export async function recentSessions(profileId: string) {
  const sessions = await db.select({
    id: practiceSessions.id, submittedAt: practiceSessions.submittedAt,
    correctPoints: practiceSessions.correctPoints, wrongPoints: practiceSessions.wrongPoints,
    total: sql<number>`jsonb_array_length(${practiceSessions.manifest})`,
    source: sql<string | null>`(select case when count(distinct q.source) = 1 then min(q.source) end
      from jsonb_array_elements(${practiceSessions.manifest}) as item(value)
      join ${questions} q on q.id = (item.value->>'id')::uuid)`,
    correct: sql<number>`count(${attempts.id}) filter (where ${attempts.correct})::int`,
    incorrect: sql<number>`count(${attempts.id}) filter (where not ${attempts.correct})::int`,
  }).from(practiceSessions).leftJoin(attempts, and(eq(attempts.sessionId, practiceSessions.id), eq(attempts.profileId, profileId)))
    .where(and(eq(practiceSessions.profileId, profileId), isNotNull(practiceSessions.submittedAt)))
    .groupBy(practiceSessions.id).orderBy(desc(practiceSessions.submittedAt), desc(practiceSessions.id)).limit(20);
  return sessions.map(({ correct, incorrect, total, correctPoints, wrongPoints, ...item }) => ({
    ...item, total, score: scoreCounts(correct, incorrect, total, correctPoints, wrongPoints),
  }));
}

export function ownedSession(id: string, profileId: string) {
  return db.select().from(practiceSessions).where(and(eq(practiceSessions.id, id), eq(practiceSessions.profileId, profileId))).limit(1)
    .then(([session]) => session);
}

export function versionLookup(manifest: TestQuestion[]) {
  return inArray(questionVersions.questionId, manifest.map(({ id }) => id));
}

export function matchVersion<T extends { questionId: string; revision: number }>(rows: T[], selected: TestQuestion) {
  return rows.find((row) => row.questionId === selected.id && row.revision === selected.revision);
}

export function practiceVersions(manifest: TestQuestion[]) {
  return db.select({
    questionId: questionVersions.questionId,
    revision: questionVersions.revision,
    content: questionVersions.content,
    subject: questionVersions.subject,
    topic: questionVersions.topic,
    source: questions.source,
    number: questions.number,
    importId: questions.importId,
  }).from(questionVersions).innerJoin(questions, eq(questionVersions.questionId, questions.id)).where(versionLookup(manifest));
}
