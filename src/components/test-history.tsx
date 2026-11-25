import Link from "next/link";
import { DeleteReview } from "@/components/practice-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPoints, testAccuracy } from "@/lib/practice-scoring";
import type { recentSessions } from "@/modules/practice";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export function TestHistory({ history }: { history: Awaited<ReturnType<typeof recentSessions>> }) {
  return <Card className="mt-5 shadow-none">
    <CardHeader><CardTitle><h2>Recent tests</h2></CardTitle></CardHeader>
    <CardContent>{history.length ? <Table aria-label="Recent test scores" className="test-history-table">
      <TableHeader><TableRow>
        <TableHead>Test</TableHead><TableHead>Submitted</TableHead><TableHead>Marks earned</TableHead><TableHead>Total marks</TableHead>
        <TableHead>Correct</TableHead><TableHead>Incorrect</TableHead><TableHead>Unanswered</TableHead><TableHead>Accuracy</TableHead><TableHead>Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>{history.map(({ id, submittedAt, source, total, score }) => {
        const accuracy = testAccuracy(score.correct, score.incorrect);
        return <TableRow key={id}>
          <TableCell className="font-medium">{source ?? "Mixed papers"}<small className="block text-muted-foreground">{total} questions</small></TableCell>
          <TableCell>{submittedAt && dateFormat.format(submittedAt)}</TableCell>
          <TableCell className="font-semibold tabular-nums">{formatPoints(score.points)}</TableCell>
          <TableCell className="tabular-nums">{formatPoints(score.maximum)}</TableCell>
          <TableCell>{score.correct}</TableCell><TableCell>{score.incorrect}</TableCell><TableCell>{score.unanswered}</TableCell>
          <TableCell>{accuracy === null ? "—" : `${accuracy}%`}</TableCell>
          <TableCell><div className="flex items-center gap-1"><Button asChild variant="outline" size="sm"><Link href={`/practice/${id}?review=1`}>Review</Link></Button><DeleteReview id={id} /></div></TableCell>
        </TableRow>;
      })}</TableBody>
    </Table> : <p className="text-sm text-muted-foreground">Finished tests will appear here.</p>}</CardContent>
  </Card>;
}
