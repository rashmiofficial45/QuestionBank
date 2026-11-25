import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type AnswerSummary = { selected?: string; answer: string; correct: boolean | null };

export function TestAnswerSummary({ id, rows }: { id: string; rows: AnswerSummary[] }) {
  return <Card id="all-answers" className="scroll-mt-4 shadow-none">
    <CardHeader><CardTitle><h2>All answers</h2></CardTitle></CardHeader>
    <CardContent><Table aria-label="All test answers">
      <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Your answer</TableHead><TableHead>Correct answer</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(({ selected, answer, correct }, index) => <TableRow key={index}>
        <TableCell><Link className="text-link" href={`/practice/${id}?review=1&q=${index + 1}`} prefetch={false}>Question {index + 1}</Link></TableCell>
        <TableCell className="max-w-xs whitespace-normal">{selected ?? "Unanswered"}</TableCell>
        <TableCell className="max-w-xs whitespace-normal">{answer}</TableCell>
        <TableCell><Badge variant="outline" className={correct === null ? undefined : correct ? "score-correct" : "score-incorrect"}>{correct === null ? "Unanswered" : correct ? "Correct" : "Incorrect"}</Badge></TableCell>
      </TableRow>)}</TableBody>
    </Table></CardContent>
  </Card>;
}
