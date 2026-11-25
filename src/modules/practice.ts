import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/database";
import { practiceSessions, questions, questionVersions, type TestQuestion } from "@/database/schema";

export function activeSession(profileId: string) {
  return db.select().from(practiceSessions).where(and(eq(practiceSessions.profileId, profileId), isNull(practiceSessions.submittedAt))).limit(1)
    .then(([session]) => session);
}

export function recentSessions(profileId: string) {
  return db.select({ id: practiceSessions.id, submittedAt: practiceSessions.submittedAt, manifest: practiceSessions.manifest })
    .from(practiceSessions).where(and(eq(practiceSessions.profileId, profileId), isNotNull(practiceSessions.submittedAt)))
    .orderBy(desc(practiceSessions.submittedAt)).limit(5);
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
    source: questions.source,
    number: questions.number,
    importId: questions.importId,
  }).from(questionVersions).innerJoin(questions, eq(questionVersions.questionId, questions.id)).where(versionLookup(manifest));
}
