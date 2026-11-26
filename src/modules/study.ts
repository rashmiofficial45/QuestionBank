import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/database";
import { attempts, bookmarks, practiceSessions, questions, questionVersions, studyRevision } from "@/database/schema";
import { presentations, type Content } from "@/lib/content";
import { isWritten } from "@/lib/written-answer";
import { isRanked } from "@/lib/ranked-answer";
import { legacyStatementPattern } from "@/lib/statement-content";

const profileName = "question_bank_profile";
export async function getProfile(create = false) {
  const jar = await cookies();
  const current = z.uuid().safeParse(jar.get(profileName)?.value);
  if (current.success) return current.data;
  if (!create) return null;
  const id = crypto.randomUUID();
  jar.set(profileName, id, {
    httpOnly: true,
    secure: process.env.STUDY_COOKIE_SECURE === "1",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

export function displayText(content: Content) {
  return content.blocks.map((block) => {
    if (block.type === "paragraph") return block.text;
    if (block.type === "statements") return block.items.map(({ label, text }) => `${label} ${text}`).join("\n");
    if (block.type === "assertion_reason") return [block.assertion, block.reason].map(({ label, text }) => `${label} ${text}`).join("\n");
    if (block.type === "image") return block.alt;
    if (block.type === "table") return [block.headers, ...block.rows].map((row) => row.join(" ")).join("\n");
    return "";
  }).filter(Boolean).join("\n");
}

export const activeQuestion = isNull(questions.archivedAt);

const listing = {
  id: questions.id, slug: questions.slug, subject: questions.subject, topic: questions.topic,
  source: questions.source, difficulty: questions.difficulty, number: questions.number, searchText: questions.searchText, tags: questions.tags, revision: questions.revision,
};
export type QuestionSummary = Pick<typeof questions.$inferSelect, keyof typeof listing>;

export const PAGE_SIZE = 8;

export const studyStatuses = {
  attempted: "Attempted", unattempted: "Unattempted", correct: "Answered correctly",
  incorrect: "Answered incorrectly", bookmarked: "Bookmarked", revision: "Marked for revision",
} as const;
export type StudyStatus = keyof typeof studyStatuses;
type StudyFilters = { topic?: string; difficulty?: string; tag?: string; status?: StudyStatus; profile?: string | null };

function profileFilter(status: StudyStatus | undefined, profile: string | null | undefined) {
  if (!status) return undefined;
  if (!profile) return status === "unattempted" ? undefined : sql`false`;
  if (status === "bookmarked") return sql`exists (select 1 from ${bookmarks} where ${bookmarks.profileId} = ${profile} and ${bookmarks.questionId} = ${questions.id})`;
  if (status === "revision") return sql`exists (select 1 from ${studyRevision} where ${studyRevision.profileId} = ${profile} and ${studyRevision.questionId} = ${questions.id})`;
  const found = sql`exists (select 1 from ${attempts} where ${attempts.profileId} = ${profile} and ${attempts.questionId} = ${questions.id}
    ${status === "correct" || status === "incorrect" ? sql`and ${attempts.correct} = ${status === "correct"}` : sql``})`;
  return status === "unattempted" ? sql`not ${found}` : found;
}

export async function browse(query = "", subject = "", page = 1, source = "", format = "", filters: StudyFilters = {}) {
  const escaped = query.replace(/[\\%_]/g, "\\$&");
  const predicate = and(
    activeQuestion,
    subject ? eq(questions.subject, subject) : undefined,
    source ? eq(questions.source, source) : undefined,
    filters.topic ? eq(questions.topic, filters.topic) : undefined,
    filters.difficulty ? eq(questions.difficulty, filters.difficulty) : undefined,
    filters.tag ? sql`${filters.tag} = any(${questions.tags})` : undefined,
    profileFilter(filters.status, filters.profile),
    format === "table" ? sql`${questions.content}->'blocks' @> '[{"type":"table"}]'::jsonb` : undefined,
    format === "assertion_reason" ? sql`${questions.content}->'blocks' @> '[{"type":"assertion_reason"}]'::jsonb` : undefined,
    format === "statements" ? sql`exists (
      select 1 from jsonb_array_elements(${questions.content}->'blocks') as item(block)
      where item.block->>'type' = 'statements'
        or (item.block->>'type' = 'paragraph' and item.block->>'text' ~* ${legacyStatementPattern})
    )` : undefined,
    format === "multiple_choice" || format === "true_false" || isWritten(format) || isRanked(format) ? sql`${questions.content}->>'interaction' = ${format}` : undefined,
    Object.hasOwn(presentations, format) ? sql`${questions.content}->>'presentation' = ${format}` : undefined,
    query ? or(sql`to_tsvector('english', ${questions.searchText}) @@ websearch_to_tsquery('english', ${query})`, ilike(questions.searchText, `%${escaped}%`)) : undefined,
  );
  const count = await db.$count(questions, predicate);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(count / PAGE_SIZE)));
  const headline = query
    ? sql<string>`ts_headline('english', ${questions.searchText}, websearch_to_tsquery('english', ${query}), ${"HighlightAll=true, StartSel=\u0001, StopSel=\u0002"})`
    : sql<null>`null`;
  const items = await db.select({ ...listing, content: questions.content, importId: questions.importId, headline })
    .from(questions).where(predicate).orderBy(questions.source, questions.number, questions.id).limit(PAGE_SIZE).offset((currentPage - 1) * PAGE_SIZE);
  return { items, count, page: currentPage };
}

export async function subjects() {
  return db.select({ name: questions.subject, count: sql<number>`count(*)::int` })
    .from(questions).where(activeQuestion).groupBy(questions.subject).orderBy(questions.subject);
}

export async function paperSources() {
  return db.selectDistinct({ name: questions.source }).from(questions).where(activeQuestion).orderBy(questions.source);
}

export async function bookmarkIds() {
  const id = await getProfile();
  return new Set(id ? (await db.select({ id: bookmarks.questionId }).from(bookmarks).where(eq(bookmarks.profileId, id))).map(({ id }) => id) : []);
}

export async function studyHistory() {
  const id = await getProfile();
  if (!id) return [];
  return db.select({
    id: attempts.id, questionId: attempts.questionId, manifest: practiceSessions.manifest, date: attempts.createdAt, correct: attempts.correct, mode: attempts.mode, sessionId: attempts.sessionId, revision: attempts.revision,
    source: questions.source, subject: questions.subject, slug: questions.slug, number: questions.number,
  }).from(attempts).innerJoin(questions, eq(attempts.questionId, questions.id))
    .leftJoin(practiceSessions, eq(attempts.sessionId, practiceSessions.id))
    .where(eq(attempts.profileId, id)).orderBy(desc(attempts.createdAt), desc(attempts.id)).limit(20);
}

export async function progress() {
  const id = await getProfile();
  if (!id) return { total: 0, correct: 0, unique: 0, saved: 0, practice: 0 };
  const [[result], [saved]] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      correct: sql<number>`count(*) filter (where ${attempts.correct})::int`,
      practice: sql<number>`count(*) filter (where ${attempts.mode} = 'practice')::int`,
      unique: sql<number>`count(distinct ${attempts.questionId})::int`,
    }).from(attempts).where(eq(attempts.profileId, id)),
    db.select({ count: sql<number>`count(*)::int` }).from(bookmarks).innerJoin(questions, eq(questions.id, bookmarks.questionId))
      .where(and(eq(bookmarks.profileId, id), activeQuestion)),
  ]);
  return { ...result, saved: saved.count };
}

export async function savedQuestions() {
  const id = await getProfile();
  if (!id) return [];
  return db.select(listing).from(bookmarks).innerJoin(questions, eq(bookmarks.questionId, questions.id))
    .where(and(eq(bookmarks.profileId, id), activeQuestion)).orderBy(desc(bookmarks.createdAt)).limit(100);
}

export async function questionBySlug(slug: string) {
  return (await db.select().from(questions).where(and(eq(questions.slug, slug), activeQuestion)).limit(1))[0];
}

export async function nextQuestion(source: string, number: number) {
  return (await db.select({ slug: questions.slug }).from(questions).where(and(activeQuestion, eq(questions.source, source), sql`${questions.number} > ${number}`))
    .orderBy(questions.number).limit(1))[0];
}

export async function revisionQueue(profileId: string) {
  const latest = db.selectDistinctOn([attempts.questionId], {
    questionId: attempts.questionId, correct: attempts.correct, missedAt: attempts.createdAt,
  }).from(attempts).where(eq(attempts.profileId, profileId))
    .orderBy(attempts.questionId, desc(attempts.createdAt), desc(attempts.id)).as("latest_attempt");
  return db.select({ ...listing, missedAt: sql<Date | null>`coalesce(${studyRevision.createdAt}, ${latest.missedAt})`, manuallyMarked: sql<boolean>`${studyRevision.questionId} is not null` })
    .from(questions).leftJoin(latest, eq(questions.id, latest.questionId))
    .leftJoin(studyRevision, and(eq(studyRevision.questionId, questions.id), eq(studyRevision.profileId, profileId)))
    .where(and(activeQuestion, or(eq(latest.correct, false), sql`${studyRevision.questionId} is not null`)))
    .orderBy(sql`coalesce(${studyRevision.createdAt}, ${latest.missedAt}) desc`, questions.id).limit(100);
}

export async function topicPerformance(profileId: string) {
  return db.select({
    subject: questionVersions.subject, topic: questionVersions.topic,
    correct: sql<number>`count(*) filter (where ${attempts.correct})::int`,
    incorrect: sql<number>`count(*) filter (where not ${attempts.correct})::int`,
  }).from(attempts).innerJoin(questionVersions,
    and(eq(questionVersions.questionId, attempts.questionId), eq(questionVersions.revision, attempts.revision)))
    .where(eq(attempts.profileId, profileId)).groupBy(questionVersions.subject, questionVersions.topic)
    .orderBy(questionVersions.subject, questionVersions.topic);
}
