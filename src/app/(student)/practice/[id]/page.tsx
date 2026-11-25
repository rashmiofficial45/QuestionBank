import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TestAnswerSummary } from "@/components/test-answer-summary";
import { TestEnded } from "@/components/test-results";
import { TestFocusButton } from "@/components/shell";
import { summarizeTopics } from "@/lib/topic-performance";
import { TestOptions, TestTimer } from "@/components/practice-forms";
import { PracticePalette } from "@/components/practice-palette";
import { QuestionContent } from "@/components/question-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPoints, scoreTest } from "@/lib/practice-scoring";
import { matchVersion, ownedSession, practiceVersions } from "@/modules/practice";
import { bookmarkIds, getProfile } from "@/modules/study";
import { setBookmark } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Practice test" };

export default async function TestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; review?: string }> }) {
  const [{ id }, { q, review }, profile] = await Promise.all([params, searchParams, getProfile()]);
  if (!profile || !z.uuid().safeParse(id).success) notFound();
  const session = await ownedSession(id, profile);
  if (!session) notFound();
  const count = session.manifest.length;
  const index = typeof q === "string" && /^\d{1,4}$/.test(q) ? Math.min(count, Math.max(1, Number(q))) - 1 : 0;
  const pinned = session.manifest[index];
  const submitted = Boolean(session.submittedAt);
  const reviewing = submitted && (review === "1" || typeof q === "string");
  const [versions, marked] = await Promise.all([
    practiceVersions(submitted ? session.manifest : [pinned]),
    submitted && !reviewing ? new Set<string>() : bookmarkIds(),
  ]);
  const question = matchVersion(versions, pinned);
  if (!question) notFound();
  const saved = marked.has(pinned.id);
  const response = session.responses[pinned.id] ?? {};
  const entries = session.manifest.map((entry) => {
    const item = session.responses[entry.id];
    return {
      answered: Boolean(item?.option), marked: Boolean(item?.marked),
      correct: submitted && item?.option ? item.option === matchVersion(versions, entry)?.content.answer : undefined,
    };
  });
  const answered = entries.filter((entry) => entry.answered).length;
  const score = submitted ? scoreTest(session.manifest.map((entry) => ({
    answer: matchVersion(versions, entry)?.content.answer ?? null, selected: session.responses[entry.id]?.option,
  })), session.correctPoints, session.wrongPoints) : null;
  if (session.submittedAt && score && !reviewing) {
    const seconds = Math.max(0, Math.floor((Math.min(session.submittedAt.getTime(), session.endsAt.getTime()) - session.createdAt.getTime()) / 1000));
    const topics = summarizeTopics(session.manifest.flatMap((entry, position) => {
      const version = matchVersion(versions, entry);
      return version ? [{ subject: version.subject, topic: version.topic, correct: entries[position].correct ?? null }] : [];
    }));
    return <TestEnded id={id} score={score} seconds={seconds} topics={topics} />;
  }
  const href = (position: number) => `/practice/${id}?${reviewing ? "review=1&" : ""}q=${position + 1}`;
  const answerSummary = reviewing ? session.manifest.map((entry, position) => {
    const content = matchVersion(versions, entry)?.content;
    const format = (optionId?: string | null) => {
      const option = content?.options.find((choice) => choice.id === optionId);
      return option ? `${option.label}. ${option.text}` : undefined;
    };
    return { selected: format(session.responses[entry.id]?.option), answer: format(content?.answer) ?? "—",
      correct: entries[position].correct ?? null };
  }) : [];
  return <div className="test-workspace">
    <header className="study-heading test-heading">
      <div><h1>{submitted ? "Test review" : "Practice test"}</h1>
        <p>{submitted ? `${formatPoints(score!.points)} / ${formatPoints(score!.maximum)} points · ${score!.correct} correct · ${score!.incorrect} incorrect · ${score!.unanswered} unanswered` : `${answered} of ${count} answered`}</p></div>
      <div className="test-controls">
        <TestFocusButton />
        {submitted ? <>
          <Button asChild variant="outline"><a href="#all-answers">All answers</a></Button>
          <Button asChild variant="outline"><Link href={`/practice/${id}`}>Results</Link></Button>
          <Button asChild variant="ghost"><Link href="/practice">Exit test</Link></Button>
        </> : <TestTimer id={id} seconds={Math.max(0, Math.ceil((session.endsAt.getTime() - Date.now()) / 1000))} unanswered={count - answered} />}
      </div>
    </header>
    <PracticePalette id={id} index={index} entries={entries} reviewing={reviewing} />
    <article className="panel test-panel">
      <div className="question-nav">
        <div>
          <div className="flex flex-wrap gap-2 items-center"><Badge variant="secondary">{question.subject}</Badge><span className="text-sm text-muted-foreground">{question.source} · Question {question.number}</span></div>
          <h2 className="test-question-title">Question {index + 1} of {count}</h2>
        </div>
        <form action={setBookmark.bind(null, pinned.id, !saved)}>
          <Button type="submit" variant="outline" aria-pressed={saved}>{saved ? <BookmarkCheck /> : <Bookmark />}{saved ? "Bookmarked" : "Bookmark"}</Button>
        </form>
      </div>
      <QuestionContent blocks={question.content.blocks} importId={question.importId} />
      <TestOptions key={pinned.id} id={id} questionId={pinned.id} options={question.content.options} response={response}
        ended={submitted} answer={submitted ? question.content.answer : undefined} />
      {submitted && question.content.explanation && <details className="source-text"><summary>Explanation</summary><p>{question.content.explanation}</p></details>}
    </article>
    <footer className="test-footer">
      {index > 0 ? <Button asChild variant="outline"><Link href={href(index - 1)}><ArrowLeft />Previous</Link></Button>
        : <Button disabled variant="outline"><ArrowLeft />Previous</Button>}
      <span className="text-muted-foreground text-sm">{index + 1} / {count}</span>
      {index + 1 < count ? <Button asChild><Link href={href(index + 1)}>Next<ArrowRight /></Link></Button>
        : <Button disabled>Next<ArrowRight /></Button>}
    </footer>
    {reviewing && <TestAnswerSummary id={id} rows={answerSummary} />}
  </div>;
}
