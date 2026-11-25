import { BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { QuestionList } from "@/components/question-list";
import { Button } from "@/components/ui/button";
import { browse, subjects } from "@/modules/study";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question bank" };

export default async function QuestionBank({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string; page?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const subject = typeof params.subject === "string" ? params.subject.slice(0, 80) : "";
  const page = typeof params.page === "string" && /^\d{1,4}$/.test(params.page) ? Math.max(1, Number(params.page)) : 1;
  const [{ items, count }, groups] = await Promise.all([browse(query, subject, page), subjects()]);
  const href = (selected: string, number = 1) => "/questions?" + new URLSearchParams({ q: query, subject: selected, page: String(number) });
  return <>
    <div className="page-heading"><span className="tile-icon violet"><BookOpen size={21} /></span><h1>Question bank</h1><p>Search published questions and practice by subject.</p></div>
    <section className="panel bank-panel">
      <form action="/questions" className="search-form"><Search size={19} /><input aria-label="Search questions" name="q" placeholder="Search by keyword, topic, or paper…" defaultValue={query} maxLength={120} /><input type="hidden" name="subject" value={subject} /><button type="submit">Search</button></form>
      <div className="filters" aria-label="Filter by subject">
        {[{ name: "" }, ...groups].map(({ name }) => <Link className={`filter ${subject === name ? "selected" : ""}`} aria-current={subject === name ? "true" : undefined} href={href(name)} key={name}>{name || "All subjects"}</Link>)}
      </div>
      <div className="results-label">{count} {count === 1 ? "question" : "questions"}{query && <> matching “{query}”</>}</div>
      <QuestionList items={items} />
      {(count > 12 || page > 1) && <div className="pagination">
        {page > 1 && <Button variant="outline" asChild><Link href={href(subject, page - 1)}><ChevronLeft size={16} />Previous</Link></Button>}
        <span>Page {page}</span>
        {page * 12 < count && <Button variant="outline" asChild><Link href={href(subject, page + 1)}>Next<ChevronRight size={16} /></Link></Button>}
      </div>}
    </section>
  </>;
}
