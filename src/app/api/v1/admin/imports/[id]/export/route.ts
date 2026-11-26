import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { adminEnabled, getDrafts, getImport, storageRoot } from "@/modules/imports";
import { encodeQuestionCsv, transferableContent } from "@/lib/question-transfer";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await adminEnabled() || !z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "json" && format !== "csv") return new Response("Choose CSV or JSON.", { status: 400 });
  const paper = await getImport(id);
  if (!paper || paper.status !== "ready") return new Response(null, { status: 404 });
  const rows = [];
  try {
    for (const { number, subject, topic, difficulty, tags, content } of await getDrafts(id)) {
      rows.push({
        number, subject: subject ?? paper.subject, topic: topic ?? "General",
        difficulty: z.enum(["Unrated", "Easy", "Medium", "Hard"]).catch("Unrated").parse(difficulty),
        tags, content: await transferableContent(content, async (crop) => {
          if (!paper.claimToken || !/^page-\d+-\d+\.png$/.test(crop.file)) throw new Error("Invalid source crop.");
          const path = join(storageRoot(), id, paper.claimToken, crop.file);
          if ((await stat(path)).size > 1_000_000) throw new Error("Source crop too large.");
          const png = await readFile(path);
          if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Invalid source image.");
          return { id: crop.id, type: "image", alt: crop.alt, data: "data:image/png;base64," + png.toString("base64") };
        }),
      });
    }
  } catch {
    return new Response("This import contains a missing or oversized source image. The question data was not exported.", { status: 422 });
  }
  return new Response(format === "csv" ? encodeQuestionCsv(rows) : JSON.stringify(rows, null, 2), {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="question-import-${id}.${format}"`, "Cache-Control": "private, no-store",
    },
  });
}
