import { and, eq, sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { db } from "@/database";
import { attempts, practiceSessions, questions, questionVersions, studyDrills } from "@/database/schema";
import { adminEnabled, getImport, storageRoot } from "@/modules/imports";
import { activeQuestion, getProfile } from "@/modules/study";

const missing = () => new Response("Source unavailable", { status: 404 });

export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const original = ["paper.pdf", "key.pdf", "explanations.pdf", "detailed.pdf"].includes(file);
  const crop = /^page-\d+-\d+\.png$/.test(file);
  const explanation = /^answer-\d+-\d+\.png$/.test(file);
  if (!z.uuid().safeParse(id).success || !(original || crop || explanation)) return missing();
  const admin = (original || new URL(request.url).searchParams.has("admin")) && await adminEnabled();
  if (original && !admin) return missing();
  if (explanation && !admin) {
    const owner = await getProfile();
    if (!owner) return missing();
    const session = z.uuid().safeParse(new URL(request.url).searchParams.get("test"));
    const manifestEntry = sql`jsonb_build_array(jsonb_build_object('id', ${questionVersions.questionId}, 'revision', ${questionVersions.revision}))`;
    const eligibleSession = session.success ? sql`or exists (
      select 1 from ${practiceSessions}
      where ${practiceSessions.id} = ${session.data} and ${practiceSessions.profileId} = ${owner}
        and ${practiceSessions.submittedAt} is not null and ${practiceSessions.manifest} @> ${manifestEntry}
      union all
      select 1 from ${studyDrills}
      where ${studyDrills.id} = ${session.data} and ${studyDrills.profileId} = ${owner}
        and (${studyDrills.submittedAt} is not null or ${studyDrills.responses}->(${questionVersions.questionId}::text)->>'answered' = 'true')
        and ${studyDrills.manifest} @> ${manifestEntry}
    )` : sql``;
    const [allowed] = await db.select({ revision: questionVersions.revision }).from(questionVersions)
      .innerJoin(questions, eq(questions.id, questionVersions.questionId))
      .where(and(eq(questions.importId, id),
        sql`${questionVersions.content}->'explanationCrops' @> ${JSON.stringify([{ file }])}::jsonb`,
        sql`(exists (select 1 from ${attempts} where ${attempts.profileId} = ${owner}
          and ${attempts.questionId} = ${questionVersions.questionId} and ${attempts.revision} = ${questionVersions.revision}) ${eligibleSession})`)).limit(1);
    if (!allowed) return missing();
  }
  if (crop && !admin) {
    const source = JSON.stringify([{ type: "source_crop", file }]);
    const optionSource = JSON.stringify([{ blocks: [{ type: "source_crop", file }] }]);
    const allowed = await db.$count(questions, and(activeQuestion, eq(questions.importId, id),
      sql`(${questions.content}->'blocks' @> ${source}::jsonb or ${questions.content}->'options' @> ${optionSource}::jsonb)`,
    ));
    if (!allowed) {
      const session = z.uuid().safeParse(new URL(request.url).searchParams.get("test"));
      const owner = session.success ? await getProfile() : null;
      if (!owner || !session.success) return missing();
      const [ownedSource] = await db.select({ revision: questionVersions.revision }).from(questionVersions)
        .innerJoin(questions, eq(questions.id, questionVersions.questionId))
        .where(and(eq(questions.importId, id),
          sql`(${questionVersions.content}->'blocks' @> ${source}::jsonb or ${questionVersions.content}->'options' @> ${optionSource}::jsonb)`,
          sql`exists (
            select 1 from ${practiceSessions}
            where ${practiceSessions.id} = ${session.data}
              and ${practiceSessions.profileId} = ${owner}
              and ${practiceSessions.manifest} @> jsonb_build_array(jsonb_build_object(
                'id', ${questionVersions.questionId}, 'revision', ${questionVersions.revision}
              ))
            union all
            select 1 from ${studyDrills}
            where ${studyDrills.id} = ${session.data}
              and ${studyDrills.profileId} = ${owner}
              and ${studyDrills.manifest} @> jsonb_build_array(jsonb_build_object(
                'id', ${questionVersions.questionId}, 'revision', ${questionVersions.revision}
              ))
          )`)).limit(1);
      if (!ownedSource) return missing();
    }
  }
  const paper = await getImport(id);
  if (!paper || (!original && (!paper.claimToken || paper.status !== "ready"))) return missing();
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
