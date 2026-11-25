import { and, eq, sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { db } from "@/database";
import { questions } from "@/database/schema";
import { adminEnabled, getImport, storageRoot } from "@/modules/imports";

const missing = () => new Response("Source unavailable", { status: 404 });

export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const original = file === "paper.pdf" || file === "key.pdf";
  const crop = /^page-\d+-\d+\.png$/.test(file);
  if (!z.uuid().safeParse(id).success || !(original || crop)) return missing();
  const admin = (original || new URL(request.url).searchParams.has("admin")) && await adminEnabled();
  if (original && !admin) return missing();
  if (crop && !admin) {
    const allowed = await db.$count(questions, and(eq(questions.importId, id),
      sql`${questions.content}->'blocks' @> ${JSON.stringify([{ type: "source_crop", file }])}::jsonb`,
    ));
    if (!allowed) return missing();
  }
  const paper = await getImport(id);
  if (!paper || (crop && (!paper.claimToken || paper.status !== "ready"))) return missing();
  try {
    const path = original ? join(storageRoot(), id, file) : join(storageRoot(), id, paper.claimToken!, file);
    const bytes = new Uint8Array(await readFile(path));
    return new Response(bytes, { headers: {
      "Content-Type": original ? "application/pdf" : "image/png",
      "Content-Disposition": `inline; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return missing();
  }
}
