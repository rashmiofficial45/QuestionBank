import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid, boolean } from "drizzle-orm/pg-core";
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
  createdAt: created(),
}, (table) => [
  index("published_subject_idx").on(table.subject),
  index("published_trigram_idx").using("gin", sql`${table.searchText} gin_trgm_ops`),
  index("published_search_idx").using("gin", sql`to_tsvector('english', ${table.searchText})`),
]);

export const attempts = pgTable("study_attempts", {
  id: uuid().primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull(),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  optionId: text("option_id").notNull(),
  correct: boolean().notNull(),
  createdAt: created(),
}, (table) => [index("attempt_profile_idx").on(table.profileId, table.createdAt)]);

export const bookmarks = pgTable("study_bookmarks", {
  profileId: uuid("profile_id").notNull(),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  createdAt: created(),
}, (table) => [unique().on(table.profileId, table.questionId)]);
