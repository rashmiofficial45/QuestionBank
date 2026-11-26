import { z } from "zod";
import { questionSchema, type Content } from "./content";

export const classificationSchema = z.object({
  subject: z.string().trim().min(1).max(60),
  topic: z.string().trim().min(1).max(80).default("General"),
  difficulty: z.enum(["Unrated", "Easy", "Medium", "Hard"]).default("Unrated"),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
});

const entrySchema = classificationSchema.extend({
  number: z.number().int().positive().max(99999),
  content: questionSchema,
});
export type TransferQuestion = z.infer<typeof entrySchema>;

function csvRecords(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], value = "", quoted = false, closed = false;
  for (let index = 0; index <= text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === undefined) throw new Error("CSV has an unclosed quoted field.");
      if (char === '"' && text[index + 1] === '"') { value += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else value += char;
    } else if (char === undefined || char === "," || char === "\n" || char === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (char !== ",") {
        if (row.some((field) => field !== "")) rows.push(row);
        row = [];
        if (char === "\r" && text[index + 1] === "\n") index++;
        if (rows.length > 1001) throw new Error("Import at most 1,000 questions at a time.");
      }
    } else if (char === '"' && !value && !closed) quoted = true;
    else if (closed || char === '"') throw new Error("CSV contains an invalid quoted field.");
    else value += char;
  }
  return rows;
}

function plainCsvContent(fields: Record<string, string>, headers: string[]): Content {
  const options = headers.filter((header) => /^option_[a-z0-9]+$/.test(header) && fields[header]?.trim())
    .map((header) => {
      const id = header.slice(7);
      return { id, label: id.toUpperCase(), text: fields[header] };
    });
  const answer = fields.answer?.trim().toLowerCase() || null;
  return {
    version: 1, interaction: "single_choice", blocks: [{ id: "stem", type: "paragraph", text: fields.question ?? "" }],
    options, answer, explanation: fields.explanation ?? "",
  };
}

export function parseQuestionTransfer(text: string, extension: "csv" | "json", subject: string): TransferQuestion[] {
  text = text.replace(/^\uFEFF/, "");
  let input: unknown;
  if (extension === "json") input = JSON.parse(text);
  else {
    const [headers, ...rows] = csvRecords(text);
    if (!headers || new Set(headers).size !== headers.length || !(headers.includes("content") || headers.includes("question"))) {
      throw new Error("CSV needs a content or question header and distinct column names.");
    }
    input = rows.map((row, index) => {
      if (row.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of fields.`);
      const fields = Object.fromEntries(headers.map((header, column) => [header, row[column]]));
      const classification = fields.classification ? JSON.parse(fields.classification) : {
        subject: fields.subject || subject, topic: fields.topic || "General", difficulty: fields.difficulty || "Unrated",
        tags: fields.tags?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [],
      };
      return { ...classification, number: fields.number ? Number(fields.number) : index + 1,
        content: fields.content ? JSON.parse(fields.content) : plainCsvContent(fields, headers) };
    });
  }
  const rows = z.array(z.unknown()).min(1).max(1000).parse(input);
  const results = rows.map((row, index) => {
    const parsed = entrySchema.safeParse(row);
    if (!parsed.success) throw new Error(`Question entry ${index + 1} has invalid ${parsed.error.issues[0].path.join(".") || "data"}.`);
    const { content } = parsed.data;
    if ([...content.blocks, ...content.options.flatMap((option) => option.blocks ?? [])].some((block) => block.type === "source_crop")) {
      throw new Error(`Question entry ${index + 1} references a crop from a separate PDF. Add its editable content without that source crop.`);
    }
    return parsed.data;
  });
  if (new Set(results.map((row) => row.number)).size !== results.length) throw new Error("Question numbers must be unique within a file.");
  return results;
}

export function encodeQuestionCsv(rows: TransferQuestion[]) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return ["number,classification,content", ...rows.map(({ number, content, ...classification }) =>
    [number, quote(JSON.stringify(classification)), quote(JSON.stringify(content))].join(","))].join("\r\n") + "\r\n";
}

type SourceCrop = Extract<Content["blocks"][number], { type: "source_crop" }>;
type PortableImage = Extract<Content["blocks"][number], { type: "image" }>;

export async function transferableContent(content: Content, resolveImage: (crop: SourceCrop) => Promise<PortableImage>): Promise<Content> {
  return {
    ...content,
    sourceRegions: undefined,
    blocks: await Promise.all(content.blocks.map((block) => block.type === "source_crop" ? resolveImage(block) : block)),
    options: await Promise.all(content.options.map(async (option) => ({
      ...option, blocks: option.blocks && await Promise.all(option.blocks.map((block) => block.type === "source_crop" ? resolveImage(block) : block)),
    }))),
  };
}
