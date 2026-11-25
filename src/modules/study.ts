import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/database";
import { attempts, bookmarks, questions } from "@/database/schema";
import type { Content } from "@/lib/content";

const profileName = "question_bank_profile";
export async function getProfile(create = false) {
  const jar = await cookies();
  const current = z.uuid().safeParse(jar.get(profileName)?.value);
  if (current.success) return current.data;
  if (!create) return null;
  const id = crypto.randomUUID();
  jar.set(profileName, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return id;
}

export function displayText(content: Content) {
  return content.blocks.flatMap((block) => block.type === "paragraph" ? [block.text] : []).join("\n");
}

const listing = {
  id: questions.id, slug: questions.slug, subject: questions.subject, topic: questions.topic,
  source: questions.source, difficulty: questions.difficulty, number: questions.number, searchText: questions.searchText,
};
export type QuestionSummary = Pick<typeof questions.$inferSelect, keyof typeof listing>;

export async function browse(query = "", subject = "", page = 1) {
  const escaped = query.replace(/[\\%_]/g, "\\$&");
  const predicate = and(
    subject ? eq(questions.subject, subject) : undefined,
    query ? or(sql`to_tsvector('english', ${questions.searchText}) @@ websearch_to_tsquery('english', ${query})`, ilike(questions.searchText, `%${escaped}%`)) : undefined,
  );
  const [items, count] = await Promise.all([
    db.select(listing).from(questions).where(predicate).orderBy(questions.source, questions.number, questions.id).limit(12).offset((page - 1) * 12),
    db.$count(questions, predicate),
  ]);
  return { items, count };
}

export async function subjects() {
  return db.select({ name: questions.subject, count: sql<number>`count(*)::int` })
    .from(questions).groupBy(questions.subject).orderBy(questions.subject);
}

export async function progress() {
  const id = await getProfile();
  if (!id) return { total: 0, correct: 0, unique: 0, saved: 0 };
  const [[result], saved] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      correct: sql<number>`count(*) filter (where ${attempts.correct})::int`,
      unique: sql<number>`count(distinct ${attempts.questionId})::int`,
    }).from(attempts).where(eq(attempts.profileId, id)),
    db.$count(bookmarks, eq(bookmarks.profileId, id)),
  ]);
  return { ...result, saved };
}

export async function savedQuestions() {
  const id = await getProfile();
  if (!id) return [];
  return db.select(listing).from(bookmarks).innerJoin(questions, eq(bookmarks.questionId, questions.id))
    .where(eq(bookmarks.profileId, id)).orderBy(desc(bookmarks.createdAt)).limit(100);
}

export async function questionBySlug(slug: string) {
  return (await db.select().from(questions).where(eq(questions.slug, slug)).limit(1))[0];
}

export async function nextQuestion(source: string, number: number) {
  return (await db.select({ slug: questions.slug }).from(questions).where(and(eq(questions.source, source), sql`${questions.number} > ${number}`))
    .orderBy(questions.number).limit(1))[0];
}
