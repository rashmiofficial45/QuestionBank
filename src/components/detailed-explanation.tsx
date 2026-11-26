import type { Content } from "@/lib/content";

export function DetailedExplanation({ text, crops, importId, sessionId, administrative, open }: {
  text?: string;
  crops?: Content["explanationCrops"];
  importId?: string | null;
  sessionId?: string;
  administrative?: boolean;
  open?: boolean;
}) {
  const sources = importId ? crops ?? [] : [];
  if (!text && !sources.length) return null;
  const access = administrative ? "?admin=1" : sessionId ? `?test=${encodeURIComponent(sessionId)}` : "";
  return <details className="source-text rounded-md border p-3" open={open}>
    <summary className="font-semibold">{sources.length ? "Detailed explanation" : "Explanation"}</summary>
    {sources.length > 0 && <div className="mt-3 grid gap-3">
      {sources.map(({ page, file }) => {
        const image = `/api/v1/source/${importId}/${file}${access}`;
        return <figure key={file} className="max-w-[46rem]">
          <a href={image} target="_blank" rel="noreferrer" aria-label={`Open full-size explanation from PDF page ${page}`}>
            <img className="w-full rounded-md border bg-white" src={image} alt={`Original detailed explanation, PDF page ${page}`} loading="lazy" />
          </a>
          <figcaption>Original explanation · PDF page {page}</figcaption>
        </figure>;
      })}
    </div>}
    {text && <p className="mt-2 whitespace-pre-wrap">{text}</p>}
  </details>;
}
