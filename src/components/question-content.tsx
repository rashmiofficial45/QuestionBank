import { SearchHighlight } from "@/components/search-highlight";
import { tableCellSpan, type Content } from "@/lib/content";
import { statementMarker } from "@/lib/statement-content";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { equationMarkup } from "@/components/option-content";

function Statements({ items, terms }: { items: { label: string; text: string }[]; terms?: string[] }) {
  return <ol className="statement-list" aria-label="Statements" role="list">
    {items.map(({ label, text }, index) => <li key={index}>
      <span><SearchHighlight text={label} terms={terms} /></span>
      <span><SearchHighlight text={text} terms={terms} /></span>
    </li>)}
  </ol>;
}

function Paragraph({ text, terms }: { text: string; terms?: string[] }) {
  type Statement = NonNullable<ReturnType<typeof statementMarker>>;
  const groups: Array<{ kind: "plain"; lines: string[] } | { kind: "list"; items: Statement[] }> = [];
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    const item = statementMarker(line);
    const current = groups.at(-1);
    const previous = current?.kind === "list" ? current.items.at(-1) : undefined;
    const next = item?.number === 1 ? statementMarker(lines[index + 1] ?? "") : undefined;
    if (item && current?.kind === "list" && previous && previous.style === item.style && previous.number + 1 === item.number) current.items.push(item);
    else if (item && next?.style === item.style && next.number === 2) groups.push({ kind: "list", items: [item] });
    else if (current?.kind === "plain") current.lines.push(line);
    else groups.push({ kind: "plain", lines: [line] });
  }
  return groups.map((group, index) => group.kind === "plain"
    ? <p key={index}><SearchHighlight text={group.lines.join("\n")} terms={terms} /></p>
    : <Statements key={index} items={group.items} terms={terms} />);
}

export function QuestionContent({ blocks, importId, administrative = false, terms, testSessionId }: {
  terms?: string[]; blocks: Content["blocks"]; importId: string | null; administrative?: boolean; testSessionId?: string;
}) {
  const fallback = blocks.some((block) => block.type === "source_crop" && !block.reference);
  const display = blocks.map((block) => {
    if (block.type === "paragraph") {
      const text = <SearchHighlight text={block.text} terms={terms} />;
      if (block.style === "ordered_list" || block.style === "unordered_list") {
        const List = block.style === "ordered_list" ? "ol" : "ul";
        return <List key={block.id} className={block.style === "ordered_list" ? "list-decimal pl-6" : "list-disc pl-6"}>
          {block.text.split("\n").filter(Boolean).map((item, index) => <li key={index}><SearchHighlight text={item} terms={terms} /></li>)}
        </List>;
      }
      if (block.style === "heading") return <h3 key={block.id} className="font-semibold">{text}</h3>;
      if (block.style === "passage" || block.style === "quote") return <blockquote key={block.id} className="my-3 whitespace-pre-wrap border-l-2 pl-4">{text}</blockquote>;
      if (block.style === "code") return <pre key={block.id} className="my-3 overflow-x-auto rounded-md border bg-muted p-4 text-sm"><code>{text}</code></pre>;
      if (block.style === "equation") {
        try {
          const markup = equationMarkup(block.text, true);
          return <div key={block.id} className="my-3 overflow-x-auto" dangerouslySetInnerHTML={{ __html: markup }} />;
        } catch {
          return <pre key={block.id} className="my-3 whitespace-pre-wrap rounded-md border p-3" aria-label="Original equation text">{text}</pre>;
        }
      }
      return <Paragraph key={block.id} text={block.text} terms={terms} />;
    }
    if (block.type === "statements") return <Statements key={block.id} items={block.items} terms={terms} />;
    if (block.type === "assertion_reason") return <dl key={block.id} aria-label="Assertion and reason" className="my-3 grid gap-2">
      {[block.assertion, block.reason].map(({ label, text }, index) => <div key={index} className="rounded-md border bg-muted/30 px-4 py-2.5">
        <dt className="text-sm font-semibold"><SearchHighlight text={label} terms={terms} /></dt>
        <dd className="whitespace-pre-line"><SearchHighlight text={text} terms={terms} /></dd>
      </div>)}
    </dl>;
    if (block.type === "image") return <img className="max-w-full rounded-md border" key={block.id} src={block.data} alt={block.alt} loading="lazy" />;
    if (block.type === "table") {
      const row = (cells: string[], index: number) => <TableRow key={index}>{cells.map((cell, col) => {
        const span = tableCellSpan(block.spans, index, col);
        if (!span) return null;
        const Cell = index === 0 ? TableHead : TableCell;
        return <Cell key={col} {...(index === 0 ? { scope: span.colSpan > 1 ? "colgroup" : "col" } : {})}
          rowSpan={span.rowSpan > 1 ? span.rowSpan : undefined} colSpan={span.colSpan > 1 ? span.colSpan : undefined}
          className={index > 0 && !block.headers[col] && !block.spans?.length ? "table-marker align-top" : "align-top whitespace-normal"}>
          <SearchHighlight text={cell} terms={terms} />
        </Cell>;
      })}</TableRow>;
      if (block.spans?.some((span) => span.row === 0 && span.rowSpan > 1)) return <div key={block.id} className="question-table rounded-md border border-border">
        <Table aria-label={`Question table from page ${block.page}`}><TableBody>{row(block.headers, 0)}{block.rows.map((cells, index) => row(cells, index + 1))}</TableBody></Table>
      </div>;
      return <div key={block.id} className="question-table rounded-md border border-border">
        <Table aria-label={`Question table from page ${block.page}`}>
          <TableHeader>{row(block.headers, 0)}</TableHeader>
          <TableBody>{block.rows.map((cells, index) => row(cells, index + 1))}</TableBody>
        </Table>
      </div>;
    }
    if (block.type !== "source_crop") return <p key={String((block as { id?: string }).id)} role="status">This content format needs a newer viewer.</p>;
    if (!importId) return null;
    const access = administrative ? "?admin=1" : testSessionId ? `?test=${encodeURIComponent(testSessionId)}` : "";
    const image = `/api/v1/source/${importId}/${block.file}${access}`;
    const figure = <figure>
      <a href={image} target="_blank" rel="noreferrer" aria-label={`Open full-size image. ${block.alt}`}>
        <img src={image} alt={block.alt} loading="lazy" />
      </a>
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
