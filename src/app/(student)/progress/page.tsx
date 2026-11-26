import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TopicPerformance } from "@/components/topic-performance";
import { ActivityChart } from "@/components/activity-chart";
import { activity } from "@/modules/activity";
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
  const [stats, history, topics, usage] = await Promise.all([progress(), studyHistory(), profile ? topicPerformance(profile) : [], activity(profile)]);
  const accuracy = stats.total ? Math.round(stats.correct * 100 / stats.total) + "%" : "—";
  const subjects = new Map<string, { subject: string; topic: string; correct: number; incorrect: number }>();
  for (const row of topics) {
    const subject = subjects.get(row.subject) ?? { subject: row.subject, topic: "All topics", correct: 0, incorrect: 0 };
    subject.correct += row.correct;
    subject.incorrect += row.incorrect;
    subjects.set(row.subject, subject);
  }
  const weakTopics = topics.filter(({ correct, incorrect }) => correct + incorrect >= 3 && incorrect > correct);
  const weakSubjects = Array.from(subjects.values()).filter(({ correct, incorrect }) => correct + incorrect >= 3 && incorrect > correct);

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
        ["Questions available", usage.total],
        ["Incorrect attempts", stats.total - stats.correct],
        ["Skipped in saved tests", usage.skipped],
        ["Time in saved tests", `${Math.floor(usage.seconds / 60)}m ${usage.seconds % 60}s`],
      ].map(([label, value]) => <Card key={label} className="dashboard-metric shadow-none"><CardContent><span>{label}</span><strong>{value}</strong></CardContent></Card>)}
    </section>
    <Card className="mb-5 shadow-none">
      <CardHeader><CardTitle><h2>Study activity</h2></CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div><dt className="text-muted-foreground">Last 7 days</dt><dd className="font-semibold">{usage.week} {usage.week === 1 ? "attempt" : "attempts"}</dd></div>
          <div><dt className="text-muted-foreground">Last 30 days</dt><dd className="font-semibold">{usage.month} {usage.month === 1 ? "attempt" : "attempts"}</dd></div>
          <div><dt className="text-muted-foreground">Study streak</dt><dd className="font-semibold">{usage.streak} {usage.streak === 1 ? "day" : "days"}</dd></div>
        </dl>
        {usage.month > 0 ? <>
          <ActivityChart data={usage.recent} />
          <details><summary className="text-sm">Daily attempt counts</summary>
            <Table aria-label="Daily attempt counts"><TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Attempts</TableHead></TableRow></TableHeader>
              <TableBody>{usage.recent.map((day) => <TableRow key={day.day}><TableCell>{day.day}</TableCell><TableCell>{day.attempts}</TableCell></TableRow>)}</TableBody>
            </Table>
          </details>
        </> : <p className="text-sm text-muted-foreground">Answer a question to start tracking your activity.</p>}
      </CardContent>
    </Card>
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
    <div className="mt-5"><TopicPerformance rows={Array.from(subjects.values())} title="Performance by subject" /></div>
    {(weakTopics.length > 0 || weakSubjects.length > 0) && <Card className="mt-5 shadow-none">
      <CardHeader><CardTitle><h2>Areas to revisit</h2></CardTitle></CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {weakSubjects.length > 0 && <p><strong>Subjects</strong> {weakSubjects.map(({ subject }) => subject).join(", ")}</p>}
        {weakTopics.length > 0 && <p><strong>Topics</strong> {weakTopics.map(({ subject, topic }) => `${subject} · ${topic}`).join(", ")}</p>}
        <p className="text-muted-foreground">Shown after at least three attempts with more incorrect than correct answers.</p>
      </CardContent>
    </Card>}
    {profile && <div className="mt-5"><ResetForm /></div>}
  </>;
}
