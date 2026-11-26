import { SearchHighlight } from "@/components/search-highlight";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { pageWindow, searchTerms } from "@/lib/study-controls";
import { ArrowRight, Bookmark, BookmarkCheck, Search } from "lucide-react";
import Link from "next/link";
import { AnswerForm } from "@/components/answer-form";
import { QuestionContent } from "@/components/question-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { setBookmark } from "@/app/(student)/actions";
import { bookmarkIds, browse, PAGE_SIZE, paperSources, subjects } from "@/modules/study";
import { presentations } from "@/lib/content";
import { writtenFormats } from "@/lib/written-answer";
import { rankedFormats } from "@/lib/ranked-answer";

type SearchParams = Promise<{ q?: string; subject?: string; source?: string; format?: string; page?: string }>;

export async function StudyFeed({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const value = (input: unknown, size: number) => typeof input === "string" ? input.trim().slice(0, size) : "";
  const query = value(params.q, 120);
  const subject = value(params.subject, 60);
  const source = value(params.source, 120);
  const formats = ["table", "statements", "assertion_reason", "true_false", "multiple_choice", ...Object.keys(presentations), ...Object.keys(writtenFormats), ...Object.keys(rankedFormats)];
  const format = params.format && formats.includes(params.format) ? params.format : "";
  const requestedPage = /^\d{1,9}$/.test(value(params.page, 10)) ? Math.max(1, Number(params.page)) : 1;
  const base = "/questions";
  const [{ items, count, page }, groups, papers, saved] = await Promise.all([browse(query, subject, requestedPage, source, format), subjects(), paperSources(), bookmarkIds()]);
  const href = (number: number) => base + "?" + new URLSearchParams({ q: query, subject, source, format, page: String(number) });
  const pageCount = Math.ceil(count / PAGE_SIZE);
  return <>
    <header className="study-heading">
      <div><h1>Question bank</h1><p>Search the collection and answer questions directly from the results.</p></div>
      <Button asChild><Link href="/practice">Start practice<ArrowRight /></Link></Button>
    </header>
    <form action={base} className="study-filters" key={`${query}-${subject}-${source}-${format}`}>
      <div className="study-search"><Search aria-hidden="true" size={17} /><Input aria-label="Search questions" name="q" defaultValue={query} placeholder="Search questions…" maxLength={120} /></div>
      <NativeSelect aria-label="Subject" name="subject" defaultValue={subject}>
        <NativeSelectOption value="">All subjects</NativeSelectOption>
        {groups.map(({ name }) => <NativeSelectOption value={name} key={name}>{name}</NativeSelectOption>)}
      </NativeSelect>
      <NativeSelect aria-label="Paper" name="source" defaultValue={source}>
        <NativeSelectOption value="">All papers</NativeSelectOption>
        {papers.map(({ name }) => <NativeSelectOption value={name} key={name}>{name}</NativeSelectOption>)}
      </NativeSelect>
      <NativeSelect aria-label="Question format" name="format" defaultValue={format}>
        <NativeSelectOption value="">All formats</NativeSelectOption>
        <NativeSelectOption value="table">Table questions</NativeSelectOption>
        <NativeSelectOption value="statements">Statement-based questions</NativeSelectOption>
        <NativeSelectOption value="assertion_reason">Assertion–Reason questions</NativeSelectOption>
        <NativeSelectOption value="true_false">True/False</NativeSelectOption>
        <NativeSelectOption value="multiple_choice">Multiple correct answers</NativeSelectOption>
        {Object.entries({ ...presentations, ...writtenFormats, ...rankedFormats }).map(([key, label]) => <NativeSelectOption key={key} value={key}>{label}</NativeSelectOption>)}
      </NativeSelect>
      <Button type="submit" variant="outline">Search</Button>
      {(query || subject || source || format) && <Button asChild variant="ghost"><Link href={base}>Clear filters</Link></Button>}
    </form>
    <div className="study-results" role="status">{count} {count === 1 ? "question" : "questions"}{query && <> matching “{query}”</>}</div>
    {!items.length && <Card className="shadow-none"><CardContent>No questions match these filters.</CardContent></Card>}
    <section className="study-grid" aria-label="Question results">
      {items.map((item) => {
        const terms = searchTerms(query, item.headline);
        const marked = saved.has(item.id);
        const detail = `/questions/${item.slug}`;
        return <article key={item.id}><Card className="study-card gap-0 shadow-none">
          <CardHeader className="study-card-header">
            <div className="study-card-meta"><Link href={detail} className="question-label">Question {item.number}</Link><span><SearchHighlight text={item.source} terms={terms} /></span></div>
            <form action={setBookmark.bind(null, item.id, !marked)}><Button variant="ghost" size="icon" aria-label={marked ? `Remove bookmark for question ${item.number}` : `Bookmark question ${item.number}`} aria-pressed={marked}>{marked ? <BookmarkCheck /> : <Bookmark />}</Button></form>
          </CardHeader>
          <CardContent>
            <div className="study-badges"><Badge variant="secondary"><SearchHighlight text={item.subject} terms={terms} /></Badge>{item.topic !== "General" && <Badge variant="outline"><SearchHighlight text={item.topic} terms={terms} /></Badge>}{item.content.blocks.some((block) => block.type === "table") && <Badge variant="outline">Table</Badge>}{item.tags.map((tag) => <Badge key={tag} variant="outline"><SearchHighlight text={tag} terms={terms} /></Badge>)}</div>
            <QuestionContent blocks={item.content.blocks} importId={item.importId} terms={terms} />
            <AnswerForm terms={terms} id={item.id} revision={item.revision} options={item.content.options} interaction={item.content.interaction} prompts={item.content.interaction === "pair_matching" ? item.content.prompts : undefined} inline />
          </CardContent>
        </Card></article>;
      })}
    </section>
    {pageCount > 1 && <Pagination aria-label="Question pages" className="mt-6">
      <PaginationContent className="flex-wrap justify-center">
        <PaginationItem>{page > 1 ? <PaginationPrevious href={href(page - 1)} /> : <Button disabled variant="ghost" size="sm">Previous</Button>}</PaginationItem>
        {pageWindow(page, pageCount).map((entry, index) => <PaginationItem key={entry === "gap" ? `gap-${index}` : entry}>
          {entry === "gap" ? <PaginationEllipsis /> : <PaginationLink href={href(entry)} isActive={entry === page} aria-label={`Page ${entry}`}>{entry}</PaginationLink>}
        </PaginationItem>)}
        <PaginationItem>{page < pageCount ? <PaginationNext href={href(page + 1)} /> : <Button disabled variant="ghost" size="sm">Next</Button>}</PaginationItem>
      </PaginationContent>
    </Pagination>}
  </>;
}
