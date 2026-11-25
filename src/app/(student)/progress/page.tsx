import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TopicPerformance } from "@/components/topic-performance";
import { ResetForm } from "@/components/reset-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProfile, progress, studyHistory, topicPerformance } from "@/modules/study";

export const metadata = { title: "Progress" };

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function ProgressPage() {
  const profile = await getProfile();
  const [stats, history, topics] = await Promise.all([progress(), studyHistory(), profile ? topicPerformance(profile) : []]);
  const accuracy = stats.total ? Math.round(stats.correct * 100 / stats.total) + "%" : "—";

  return <>
    <header className="study-heading">
      <div><h1>Study progress</h1><p>Track practice and review attempts saved in this browser.</p></div>
      <Button asChild><Link href="/practice">Continue practice<ArrowRight /></Link></Button>
    </header>
    <section className="metrics" aria-label="Progress summary">
      {[
        ["Total attempts", stats.total],
        ["Unique questions", stats.unique],
        ["Practice attempts", stats.practice],
        ["Answer accuracy", accuracy],
      ].map(([label, value]) => <Card key={label} className="dashboard-metric shadow-none"><CardContent><span>{label}</span><strong>{value}</strong></CardContent></Card>)}
    </section>
    <Card className="shadow-none">
      <CardHeader><CardTitle><h2>Recent attempts</h2></CardTitle>
        {stats.total > 0 && <p className="text-sm text-muted-foreground">{stats.correct} of {stats.total} attempts were correct.</p>}
      </CardHeader>
      <CardContent>
        {history.length ? <Table aria-label="Recent attempts">
          <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Mode</TableHead><TableHead>Result</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
          <TableBody>{history.map((attempt) => <TableRow key={attempt.id}>
            <TableCell><Link className="text-link" href={attempt.sessionId ? `/practice/${attempt.sessionId}?review=1&q=${(attempt.manifest?.findIndex(({ id }) => id === attempt.questionId) ?? 0) + 1}` : `/questions/${attempt.slug}`}>{attempt.source} · Question {attempt.number}</Link>{attempt.revision > 1 && <span className="ml-2 text-xs text-muted-foreground">v{attempt.revision}</span>}</TableCell>
            <TableCell>{attempt.mode === "practice" ? "Practice" : attempt.mode === "bank" ? "Question bank" : "Study"}</TableCell>
            <TableCell><Badge variant={attempt.correct ? "default" : "outline"}>{attempt.correct ? "Correct" : "Incorrect"}</Badge></TableCell>
            <TableCell><time dateTime={attempt.date.toISOString()}>{dateFormat.format(attempt.date)}</time></TableCell>
          </TableRow>)}</TableBody>
        </Table> : <p className="text-sm text-muted-foreground">Answer a question to see your activity here.</p>}
      </CardContent>
    </Card>
    <div className="mt-5"><TopicPerformance rows={topics} /></div>
    {(stats.total > 0 || stats.saved > 0) && <div className="mt-5"><ResetForm /></div>}
  </>;
}
