const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const marker = /^(?<label>(?<prefix>Statement[ \t]+)?(?:\((?<wrapped>\d{1,2}|[IVX]+)\)|(?<bare>\d{1,2}|[IVX]+)[.):]))[ \t]+(?<text>\S.*)$/i;

export function statementMarker(line: string) {
  const match = marker.exec(line);
  if (!match?.groups) return;
  const { label, prefix, wrapped, bare, text } = match.groups;
  const ordinal = wrapped ?? bare;
  const numeric = /^\d/.test(ordinal);
  const number = numeric ? Number(ordinal) : roman.indexOf(ordinal.toUpperCase()) + 1;
  if (number > 0) return { label, text, number, style: `${Boolean(prefix)}:${numeric}` };
}

const statementPairs = ["", "Statement[[:blank:]]+"].flatMap((prefix) =>
  [["1", "2"], ["I", "II"]].map(([first, second]) => {
    const line = (ordinal: string) => `${prefix}(?:\\(${ordinal}\\)|${ordinal}[.):])[[:blank:]]+[^\\n]+`;
    return `${line(first)}\\n${line(second)}`;
  }),
);

export const legacyStatementPattern = `(?:^|\\n)(?:${statementPairs.join("|")})`;
