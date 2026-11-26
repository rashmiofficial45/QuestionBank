export const writtenFormats = {
  numeric: "Numerical answer",
  fill_blank: "Fill in the blank",
  short_answer: "Short answer",
  descriptive: "Descriptive answer",
} as const;

export type WrittenInteraction = keyof typeof writtenFormats;

export function isWritten(interaction: string): interaction is WrittenInteraction {
  return Object.hasOwn(writtenFormats, interaction);
}

export function normalizeWritten(interaction: WrittenInteraction, value: string) {
  if (interaction === "numeric") {
    const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(value.trim());
    if (!match || !(match[2] || match[3]) || value.length > 100) return null;
    const integer = match[2].replace(/^0+/, "") || "0";
    const fraction = (match[3] ?? "").replace(/0+$/, "");
    const sign = match[1] === "-" && (integer !== "0" || fraction) ? "-" : "";
    return sign + integer + (fraction ? "." + fraction : "");
  }
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase() || null;
}

export function gradeWritten(interaction: WrittenInteraction, answer?: string | null, selection?: string | null) {
  if (interaction === "descriptive" || !selection?.trim()) return null;
  const expected = answer && normalizeWritten(interaction, answer);
  return Boolean(expected && expected === normalizeWritten(interaction, selection));
}
