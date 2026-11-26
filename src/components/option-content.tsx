import katex from "katex";
import { SearchHighlight } from "@/components/search-highlight";
import type { Content } from "@/lib/content";

export function equationMarkup(text: string, displayMode = false) {
  return katex.renderToString(text, { trust: false, output: "mathml", displayMode, maxExpand: 100, maxSize: 20 });
}

function Equation({ text }: { text: string }) {
  try {
    return <span dangerouslySetInnerHTML={{ __html: equationMarkup(text) }} />;
  } catch {
    return <code className="whitespace-pre-wrap" aria-label="Original equation text">{text}</code>;
  }
}

export function OptionContent({ option, importId, terms, administrative, testSessionId }: {
  option: Content["options"][number]; importId?: string | null; terms?: string[]; administrative?: boolean; testSessionId?: string;
}) {
  const equation = option.blocks?.find((block) => block.type === "paragraph");
  const images = option.blocks?.filter((block) => block.type === "source_crop" || block.type === "image") ?? [];
  if (!equation && (!images.some((block) => block.type === "image" || importId))) return <span><SearchHighlight text={option.text} terms={terms} /></span>;
  const access = administrative ? "?admin=1" : testSessionId ? `?test=${encodeURIComponent(testSessionId)}` : "";
  return <span className="grid min-w-0 gap-2 text-left">
    {equation ? <Equation text={equation.text} /> : <SearchHighlight text={option.text} terms={terms} />}
    {images.filter((block) => block.type === "image" || importId).map((block) => <img key={block.id} alt={block.alt} loading="lazy" className="max-h-48 max-w-full rounded-sm border object-contain"
      src={block.type === "image" ? block.data : `/api/v1/source/${importId}/${block.file}${access}`} />)}
  </span>;
}
