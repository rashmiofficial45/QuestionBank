export const polityDetailedPaper = "Test-01-Polity-01-Detailed-Explaination-23-Nov-.pdf";

// Minimal native-text PDF for tests whose original fixtures only contain a key.
export function detailedFixture(...answers: string[]) {
  const lines = [
    "Answer Key", ...answers.map((answer, index) => `${index + 1}. ${answer}`),
    ...answers.flatMap((answer, index) => [`Q${index + 1}.`, `Answer: ${answer}`, "Explanation: Refer to the answer above."]),
  ];
  const stream = "BT /F1 12 Tf 36 750 Td " +
    lines.map((line) => `(${line.replace(/[()\\]/g, "\\$&")}) Tj 0 -20 Td`).join(" ") + " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { name: "detailed.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf) };
}
