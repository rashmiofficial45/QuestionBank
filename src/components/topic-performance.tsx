import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { testAccuracy } from "@/lib/practice-scoring";

export type TopicPerformanceRow = {
  subject: string;
  topic: string;
  correct: number;
  incorrect: number;
  unanswered?: number;
};

export function TopicPerformance({ rows, title = "Performance by topic" }: { rows: TopicPerformanceRow[]; title?: string }) {
  const includeUnanswered = rows.some((row) => row.unanswered !== undefined);
  return <Card className="shadow-none">
    <CardHeader><CardTitle><h2>{title}</h2></CardTitle></CardHeader>
    <CardContent>{rows.length ? <Table aria-label={title}>
      <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Topic</TableHead><TableHead>Answered</TableHead><TableHead>Correct</TableHead><TableHead>Incorrect</TableHead>{includeUnanswered && <TableHead>Unanswered</TableHead>}<TableHead>Accuracy</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(({ subject, topic, correct, incorrect, unanswered }) => {
        const accuracy = testAccuracy(correct, incorrect);
        return <TableRow key={JSON.stringify([subject, topic])}>
          <TableCell>{subject}</TableCell><TableCell>{topic}</TableCell><TableCell>{correct + incorrect}</TableCell><TableCell>{correct}</TableCell><TableCell>{incorrect}</TableCell>
          {includeUnanswered && <TableCell>{unanswered ?? 0}</TableCell>}<TableCell>{accuracy === null ? "—" : `${accuracy}%`}</TableCell>
        </TableRow>;
      })}</TableBody>
    </Table> : <p className="text-sm text-muted-foreground">Answer questions to see your performance by subject and topic.</p>}</CardContent>
  </Card>;
}
