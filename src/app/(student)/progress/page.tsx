import { ChartNoAxesColumnIncreasing, CircleCheck, Target } from "lucide-react";
import { ResetForm } from "@/components/reset-form";
import { progress } from "@/modules/study";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const stats = await progress();
  return <>
    <div className="page-heading"><span className="tile-icon violet"><ChartNoAxesColumnIncreasing size={21} /></span><h1>Progress</h1><p>Review the answers you checked in this browser.</p></div>
    <section className="metrics metrics-three" aria-label="Progress summary">
      {[
        ["Total attempts", stats.total, Target],
        ["Unique questions", stats.unique, CircleCheck],
        ["Correct answers", stats.correct, ChartNoAxesColumnIncreasing],
      ].map(([label, value, Icon]) => {
        const MetricIcon = Icon as typeof Target;
        return <article className="metric" key={String(label)}><span className="tile-icon violet"><MetricIcon size={17} /></span><div><strong>{String(value)}</strong><span>{String(label)}</span></div></article>;
      })}
    </section>
    <section className="panel bank-panel progress-panel">
      <h2>Answer accuracy</h2>
      {stats.total ? <><p>{stats.correct} of {stats.total} attempts were correct.</p><progress aria-label="Answer accuracy" value={stats.correct} max={stats.total} /></> : <p>Check an answer in practice to see your accuracy.</p>}
      {(stats.total > 0 || stats.saved > 0) && <ResetForm />}
    </section>
  </>;
}
