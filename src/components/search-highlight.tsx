import { searchSegments } from "@/lib/study-controls";

export function SearchHighlight({ text, terms = [] }: { text: string; terms?: string[] }) {
  return searchSegments(text, terms).map((part, index) => part.match
    ? <mark className="search-hit" key={index}>{part.text}</mark>
    : part.text);
}
