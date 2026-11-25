import { ArrowRight, Bookmark, BookOpen, ChartNoAxesColumnIncreasing, CircleCheck, Search, Target } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuestionList, SubjectIcon } from "@/components/question-list";
import { browse, progress, subjects } from "@/modules/study";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [groups, stats, bank] = await Promise.all([subjects(), progress(), browse()]);
  const accuracy = stats.total ? `${Math.round(stats.correct / stats.total * 100)}%` : "—";
  return <>
    <section className="study-hero">
      <div className="hero-copy">
        <span className="hero-tag"><span /> UPSC preparation</span>
        <h1>Your study<br />workspace.</h1>
        <p>Explore the question bank, practice with real exam material, and track your progress as you go.</p>
        <div className="hero-actions"><Button asChild variant="light"><Link href="/practice"><Target size={17} /> Start practice <ArrowRight size={16} /></Link></Button><Button asChild variant="ghost" className="hero-link"><Link href="/questions">Browse questions</Link></Button></div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="orbit-axis orbit-vertical" /><div className="orbit-axis orbit-horizontal" />
        <div className="orbit-star">✦</div><span className="orbital-point point-top" /><span className="orbital-point point-right" /><span className="orbital-point point-bottom" />
      </div>
    </section>
    <section aria-label="Your study summary" className="metrics">
      {[
        { label: "Questions available", value: bank.count, icon: BookOpen, tone: "violet" },
        { label: "Questions attempted", value: stats.unique, icon: CircleCheck, tone: "mint" },
        { label: "Answer accuracy", value: accuracy, icon: ChartNoAxesColumnIncreasing, tone: "orange" },
        { label: "Bookmarked", value: stats.saved, icon: Bookmark, tone: "blue" },
      ].map(({ label, value, icon: Icon, tone }) => <article className="metric" key={label}><span className={`tile-icon ${tone}`}><Icon size={17} /></span><div><strong>{value}</strong><span>{label}</span></div></article>)}
    </section>
    <div className="dashboard-grid">
      <section className="dashboard-bank">
        <div className="section-heading"><div><h2>Explore questions</h2><p>Find a question by topic, keyword, or paper.</p></div><Link className="text-link" href="/questions">View bank <ArrowRight size={15} /></Link></div>
        <form action="/questions" className="search-form"><Search size={19} /><input aria-label="Search questions" name="q" placeholder="Search the question bank…" maxLength={120} /><button type="submit">Search</button></form>
        <QuestionList items={bank.items.slice(0, 4)} empty="Published questions will appear here." />
      </section>
      <section>
        <div className="section-heading"><div><h2>Subjects</h2><p>Focus your next study session.</p></div></div>
        <div className="subject-list">{groups.length === 0 && <p className="empty">Subjects appear when questions are published.</p>}
          {groups.map(({ name, count }) => <Link href={`/questions?subject=${encodeURIComponent(name)}`} key={name}><span className="tile-icon violet"><SubjectIcon name={name} size={17} /></span><span><strong>{name}</strong><small>{count} {count === 1 ? "question" : "questions"}</small></span><ArrowRight size={15} /></Link>)}
        </div>
      </section>
    </div>
  </>;
}
