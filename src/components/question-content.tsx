import { SearchHighlight } from "@/components/search-highlight";
import type { Content } from "@/lib/content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function Paragraph({ text, terms }: { text: string; terms?: string[] }) {
  const groups: Array<{ kind: "plain"; lines: string[] } | { kind: "list"; start: number; items: string[] }> = [];
  for (const line of text.split("\n")) {
    const numbered = /^(\d{1,2})\.\s+(.+)$/.exec(line);
    const current = groups.at(-1);
    if (numbered && (Number(numbered[1]) === 1 || (current?.kind === "list" && Number(numbered[1]) === current.start + current.items.length))) {
      if (current?.kind === "list" && Number(numbered[1]) === current.start + current.items.length) current.items.push(numbered[2]);
      else groups.push({ kind: "list", start: Number(numbered[1]), items: [numbered[2]] });
    } else if (current?.kind === "plain") current.lines.push(line);
    else groups.push({ kind: "plain", lines: [line] });
  }
  return groups.map((group, index) => group.kind === "plain"
    ? <p key={index}><SearchHighlight text={group.lines.join("\n")} terms={terms} /></p>
    : <ol key={index} start={group.start}>{group.items.map((item, itemIndex) => <li key={itemIndex}><SearchHighlight text={item} terms={terms} /></li>)}</ol>);
}

export function QuestionContent({ blocks, importId, administrative = false, terms }: { terms?: string[]; blocks: Content["blocks"]; importId: string | null; administrative?: boolean }) {
  const fallback = blocks.some((block) => block.type === "source_crop" && !block.reference);
  const display = blocks.map((block) => {
    if (block.type === "paragraph") return <Paragraph key={block.id} text={block.text} terms={terms} />;
    if (block.type === "table") return <div key={block.id} className="question-table rounded-md border border-border">
      <Table aria-label={`Question table from page ${block.page}`}>
        <TableHeader><TableRow>{block.headers.map((header, index) => <TableHead scope="col" key={index} className="whitespace-normal"><SearchHighlight text={header} terms={terms} /></TableHead>)}</TableRow></TableHeader>
        <TableBody>{block.rows.map((row, index) => <TableRow key={index}>{row.map((cell, col) => <TableCell key={col} className={block.headers[col] ? "align-top whitespace-normal" : "table-marker align-top"}><SearchHighlight text={cell} terms={terms} /></TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>;
    if (!importId) return null;
    const figure = <figure>
      <img src={`/api/v1/source/${importId}/${block.file}${administrative ? "?admin=1" : ""}`} alt={block.alt} loading="lazy" />
      <figcaption>Original paper · Page {block.page}</figcaption>
    </figure>;
    return block.reference
      ? <details className="source-text" key={block.id}><summary>Original PDF crop</summary>{figure}</details>
      : <div key={block.id}>{figure}</div>;
  });
  return <div className="question-content">
    {fallback ? <>{display.filter((_, index) => blocks[index].type === "source_crop")}<details className="source-text"><summary>Extracted text</summary>{display.filter((_, index) => blocks[index].type !== "source_crop")}</details></> : display}
  </div>;
}
