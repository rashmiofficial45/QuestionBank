export function pageWindow(page: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  if (page <= 3) return [1, 2, 3, "gap", total] as const;
  if (page >= total - 2) return [1, "gap", total - 2, total - 1, total] as const;
  return [1, "gap", page - 1, page, page + 1, "gap", total] as const;
}

export function searchSegments(text: string, terms: string[]) {
  const escaped = Array.from(new Set(terms.filter(Boolean))).sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return [{ text, match: false }];
  return text.split(new RegExp(`(${escaped.join("|")})`, "giu"))
    .map((part, index) => ({ text: part, match: Boolean(index % 2) }))
    .filter((part) => part.text);
}

export function searchTerms(query: string, headline: string | null) {
  const matched = headline?.matchAll(/\u0001([^\u0002]+)\u0002/g);
  return [...new Set([query, ...(matched ? Array.from(matched, (part) => part[1]) : [])])].filter(Boolean);
}
