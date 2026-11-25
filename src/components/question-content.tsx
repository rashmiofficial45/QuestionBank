import type { Content } from "@/lib/content";

export function QuestionContent({ blocks, importId, administrative = false }: { blocks: Content["blocks"]; importId: string | null; administrative?: boolean }) {
  const paragraphs = blocks.flatMap((block) => block.type === "paragraph" ? [<p key={block.id}>{block.text}</p>] : []);
  const images = blocks.flatMap((block) => block.type === "source_crop" && importId
    ? [<figure key={block.id}>
        <img src={`/api/v1/source/${importId}/${block.file}${administrative ? "?admin=1" : ""}`} alt={block.alt} />
        <figcaption>Original paper · Page {block.page}</figcaption>
      </figure>]
    : []);
  return <div className="question-content">{images.length ? <>{images}<details className="source-text"><summary>Extracted text</summary>{paragraphs}</details></> : paragraphs}</div>;
}
