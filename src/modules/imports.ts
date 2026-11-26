import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "@/database";
import { drafts, editorialEvents, imports, questions, questionVersions } from "@/database/schema";

export async function adminEnabled() {
  if (process.env.ENABLE_PRIVATE_ADMIN !== "1") return false;
  const host = (await headers()).get("host") ?? "";
  return /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host);
}

export async function requireAdmin() {
  if (!await adminEnabled()) notFound();
}

export const storageRoot = () => resolve(process.env.STORAGE_DIR ?? ".data");

export async function hasExplanationPDF(id: string) {
  return stat(resolve(storageRoot(), id, "explanations.pdf")).then((file) => file.isFile(), () => false);
}

export function recentImports() {
  return db.select().from(imports).orderBy(desc(imports.createdAt)).limit(100);
}

export async function getImport(id: string) {
  return (await db.select().from(imports).where(eq(imports.id, id)))[0];
}

export function getDrafts(id: string) {
  return db.select({
    ...getTableColumns(drafts),
    published: questions.id,
    publishedGeneration: questions.draftGeneration,
    publishedRevision: questions.revision,
    archivedAt: questions.archivedAt,
  }).from(drafts).leftJoin(questions, and(eq(questions.draftId, drafts.id), eq(questions.importId, id)))
    .where(eq(drafts.importId, id)).orderBy(drafts.number);
}

export function importActivity(importId: string) {
  return db.select().from(editorialEvents).where(eq(editorialEvents.importId, importId))
    .orderBy(desc(editorialEvents.createdAt)).limit(100);
}

export function versionHistory(questionId: string) {
  return db.select().from(questionVersions).where(eq(questionVersions.questionId, questionId))
    .orderBy(desc(questionVersions.revision));
}
