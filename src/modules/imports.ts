import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolve } from "node:path";
import { db } from "@/database";
import { drafts, imports, questions } from "@/database/schema";

export async function adminEnabled() {
  if (process.env.ENABLE_PRIVATE_ADMIN !== "1") return false;
  const host = (await headers()).get("host") ?? "";
  return /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host);
}

export async function requireAdmin() {
  if (!await adminEnabled()) notFound();
}

export const storageRoot = () => resolve(process.env.STORAGE_DIR ?? ".data");

export function recentImports() {
  return db.select().from(imports).orderBy(desc(imports.createdAt)).limit(100);
}

export async function getImport(id: string) {
  return (await db.select().from(imports).where(eq(imports.id, id)))[0];
}

export function getDrafts(id: string) {
  return db.select({
    ...{
      id: drafts.id, importId: drafts.importId, number: drafts.number, page: drafts.page,
      content: drafts.content, original: drafts.original, issues: drafts.issues, editedAt: drafts.editedAt,
    },
    published: questions.id,
  }).from(drafts).leftJoin(questions, and(eq(questions.draftId, drafts.id), eq(questions.importId, id)))
    .where(eq(drafts.importId, id)).orderBy(drafts.number);
}
