import { ArrowRight, Bookmark, BookOpen, ChartNoAxesColumnIncreasing, Target } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuestionList, SubjectIcon } from "@/components/question-list";
import { browse, progress, subjects } from "@/modules/study";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [groups, stats, bank] = await Promise.all([subjects(), progress(), browse()]);
  const accuracy = stats.total ? `${Math.round(stats.correct / stats.total * 100)}%` : "—";
  return <>
    <div className="study-heading mb-6">
      <div><h1>Your study workspace</h1><p>Find your next question or pick up a practice session.</p></div>
      <Button asChild><Link href="/practice"><Target /> Start practice <ArrowRight /></Link></Button>
    </div>
    <section aria-label="Your study summary" className="metrics">
      {[
        { label: "Questions available", value: bank.count, icon: BookOpen, href: "/questions" },
        { label: "Practice attempts", value: stats.practice, icon: Target, href: "/progress" },
        { label: "Answer accuracy", value: accuracy, icon: ChartNoAxesColumnIncreasing, href: "/progress" },
        { label: "Bookmarked", value: stats.saved, icon: Bookmark, href: "/bookmarks" },
      ].map(({ label, value, icon: Icon, href }) => <Card key={label} className="dashboard-metric shadow-none"><Link href={href}><Icon size={17} /><span>{label}</span><strong>{value}</strong></Link></Card>)}
    </section>
    <div className="dashboard-grid">
      <section className="dashboard-bank">
        <div className="section-heading"><div><h2>Explore questions</h2></div><Link className="text-link" href="/questions">View bank <ArrowRight size={15} /></Link></div>
        <form action="/questions" className="flex gap-2"><Input aria-label="Search questions" name="q" placeholder="Search by topic, keyword, or paper" maxLength={120} /><Button type="submit" variant="outline">Search</Button></form>
        <QuestionList items={bank.items.slice(0, 4)} empty="Published questions will appear here." />
      </section>
      <section>
        <div className="section-heading"><h2>Subjects</h2></div>
        <Card className="gap-0 py-0 shadow-none"><CardContent className="px-0">
          <div className="subject-list border-0">{groups.length === 0 && <p className="empty">Subjects appear when questions are published.</p>}
            {groups.map(({ name, count }) => <Link href={`/questions?subject=${encodeURIComponent(name)}`} key={name}><span className="tile-icon"><SubjectIcon name={name} size={17} /></span><span><strong>{name}</strong><small>{count} {count === 1 ? "question" : "questions"}</small></span><ArrowRight size={15} /></Link>)}
          </div>
        </CardContent></Card>
      </section>
    </div>
  </>;
}
