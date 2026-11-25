import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, primaryKey, uuid, boolean } from "drizzle-orm/pg-core";
import type { Content } from "../lib/content";

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const imports = pgTable("paper_imports", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  subject: text().notNull(),
  paperName: text("paper_name").notNull(),
  keyName: text("key_name").notNull(),
  status: text().notNull().default("queued"),
  stage: text().notNull().default("Waiting for worker"),
  error: text(),
  attempts: integer().notNull().default(0),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  claimToken: uuid("claim_token"),
  createdAt: created(),
}, (table) => [index("import_queue_idx").on(table.status, table.createdAt)]);

export const drafts = pgTable("question_drafts", {
  id: uuid().primaryKey().defaultRandom(),
  importId: uuid("import_id").notNull().references(() => imports.id),
  number: integer().notNull(),
  page: integer().notNull(),
  content: jsonb().$type<Content>().notNull(),
  original: jsonb().$type<Content>().notNull(),
  issues: jsonb().$type<string[]>().notNull().default([]),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  generation: integer().notNull().default(1),
  subject: text(),
  topic: text(),
  difficulty: text(),
  tags: text().array().notNull().default([]),
}, (table) => [unique().on(table.importId, table.number)]);

export const questions = pgTable("published_questions", {
  id: uuid().primaryKey().defaultRandom(),
  draftId: uuid("draft_id").unique().references(() => drafts.id),
  importId: uuid("import_id").references(() => imports.id),
  slug: text().notNull().unique(),
  subject: text().notNull(),
  topic: text().notNull(),
  source: text().notNull(),
  difficulty: text().notNull(),
  number: integer().notNull(),
  content: jsonb().$type<Content>().notNull(),
  searchText: text("search_text").notNull(),
  revision: integer().notNull().default(1),
  draftGeneration: integer("draft_generation").notNull().default(1),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  tags: text().array().notNull().default([]),
  createdAt: created(),
}, (table) => [
  index("published_subject_idx").on(table.subject),
  index("published_trigram_idx").using("gin", sql`${table.searchText} gin_trgm_ops`),
  index("published_search_idx").using("gin", sql`to_tsvector('english', ${table.searchText})`),
]);

export const questionVersions = pgTable("question_versions", {
  questionId: uuid("question_id").notNull().references(() => questions.id),
  revision: integer().notNull(),
  content: jsonb().$type<Content>().notNull(),
  subject: text().notNull(),
  topic: text().notNull(),
  difficulty: text().notNull(),
  tags: text().array().notNull().default([]),
  createdAt: created(),
}, (table) => [primaryKey({ columns: [table.questionId, table.revision] })]);

export type TestQuestion = { id: string; revision: number };
export type TestResponse = { option?: string; marked?: boolean };

export const practiceSessions = pgTable("practice_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull(),
  manifest: jsonb().$type<TestQuestion[]>().notNull(),
  responses: jsonb().$type<Record<string, TestResponse>>().notNull().default({}),
  correctPoints: integer("correct_points").notNull(),
  wrongPoints: integer("wrong_points").notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: created(),
}, (table) => [
  uniqueIndex("one_active_practice_per_profile").on(table.profileId).where(sql`${table.submittedAt} is null`),
  index("practice_profile_date_idx").on(table.profileId, table.createdAt),
]);

export const editorialEvents = pgTable("editorial_events", {
  id: uuid().primaryKey().defaultRandom(),
  importId: uuid("import_id").notNull().references(() => imports.id),
  questionNumber: integer("question_number"),
  type: text().notNull(),
  detail: text().notNull(),
  createdAt: created(),
}, (table) => [index("editorial_import_date_idx").on(table.importId, table.createdAt)]);

export const attempts = pgTable("study_attempts", {
  id: uuid().primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull(),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  optionId: text("option_id").notNull(),
  revision: integer().notNull().default(1),
  sessionId: uuid("session_id").references(() => practiceSessions.id),
  mode: text().$type<"practice" | "bank">(),
  correct: boolean().notNull(),
  createdAt: created(),
}, (table) => [index("attempt_profile_idx").on(table.profileId, table.createdAt), unique().on(table.sessionId, table.questionId)]);

export const bookmarks = pgTable("study_bookmarks", {
  profileId: uuid("profile_id").notNull(),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  createdAt: created(),
}, (table) => [unique().on(table.profileId, table.questionId)]);
