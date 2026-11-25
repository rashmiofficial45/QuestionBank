import { ArrowRight, CircleCheck } from "lucide-react";
import Link from "next/link";
import { TopicPerformance, type TopicPerformanceRow } from "@/components/topic-performance";
import { TestFocusButton } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPoints, testAccuracy, type scoreCounts } from "@/lib/practice-scoring";

type Score = ReturnType<typeof scoreCounts>;

export function TestEnded({ id, score, seconds, topics }: { id: string; score: Score; seconds: number; topics: TopicPerformanceRow[] }) {
  const accuracy = testAccuracy(score.correct, score.incorrect);
  const metrics = [
    ["Marks", `${formatPoints(score.points)} / ${formatPoints(score.maximum)}`],
    ["Correct", score.correct],
    ["Incorrect", score.incorrect],
    ["Unanswered", score.unanswered],
  ] as const;
  return <div className="test-workspace test-results">
    <header className="study-heading">
      <div><h1>Test ended</h1><p>Your test has been submitted.</p></div>
      <TestFocusButton />
    </header>
    <section className="metrics" aria-label="Final test score">
      {metrics.map(([label, value]) => <Card key={label} className="dashboard-metric shadow-none">
        <CardContent><span>{label}</span><strong>{value}</strong></CardContent>
      </Card>)}
    </section>
    <Card className="shadow-none">
      <CardHeader><CardTitle className="flex items-center gap-2"><CircleCheck size={19} />Test analytics</CardTitle></CardHeader>
      <CardContent className="grid gap-5">
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <div><dt className="text-muted-foreground">Accuracy</dt><dd className="font-semibold">{accuracy === null ? "—" : `${accuracy}%`}</dd></div>
          <div><dt className="text-muted-foreground">Time taken</dt><dd className="font-semibold">{Math.floor(seconds / 60)}m {seconds % 60}s</dd></div>
        </dl>
        <div className="test-controls">
          <Button asChild><Link href={`/practice/${id}?review=1`}>Review answers<ArrowRight /></Link></Button>
          <Button asChild variant="outline"><Link href="/practice">Exit test</Link></Button>
        </div>
      </CardContent>
    </Card>
    <TopicPerformance rows={topics} />
  </div>;
}
