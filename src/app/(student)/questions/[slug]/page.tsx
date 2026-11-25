import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck } from "lucide-react";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AnswerForm } from "@/components/answer-form";
import { QuestionContent } from "@/components/question-content";
import { db } from "@/database";
import { bookmarks } from "@/database/schema";
import { getProfile, nextQuestion, questionBySlug, revisionQueue } from "@/modules/study";
import { setBookmark } from "../../actions";

export const dynamic = "force-dynamic";

export default async function QuestionPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ practice?: string; from?: string }> }) {
  const [{ slug }, { practice, from }, id] = await Promise.all([params, searchParams, getProfile()]);
  const question = await questionBySlug(slug);
  if (!question) notFound();
  const revising = from === "revision";
  const [next, saved] = await Promise.all([
    revising ? id && revisionQueue(id).then((queue) => queue.find((item) => item.id !== question.id)) : nextQuestion(question.source, question.number),
    id ? db.$count(bookmarks, and(eq(bookmarks.profileId, id), eq(bookmarks.questionId, question.id))) : 0,
  ]);
  const nextHref = next ? `/questions/${next.slug}${revising ? "?from=revision" : practice === "1" ? "?practice=1" : ""}` : undefined;
  return <div className="question-workspace">
    <div className="question-nav"><Link className="text-link" href={revising ? "/revision" : "/questions"}><ArrowLeft size={16} /> {revising ? "Back to Revision" : "Question bank"}</Link><form action={setBookmark.bind(null, question.id, !saved)}><Button type="submit" variant="outline">{saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}{saved ? "Bookmarked" : "Bookmark"}</Button></form></div>
    <article className="panel solve-panel">
      <div className="question-kicker"><span className="pill">{question.subject}</span><span>{question.source}</span></div>
      <h1>Question {question.number}</h1>
      <QuestionContent blocks={question.content.blocks} importId={question.importId} />
      <AnswerForm mode={practice === "1" ? "practice" : "bank"} id={question.id} revision={question.revision} options={question.content.options} interaction={question.content.interaction} next={nextHref} />
    </article>
    {nextHref && <div className="question-nav"><span /><Link className="text-link" href={nextHref}>Skip to next question <ArrowRight size={16} /></Link></div>}
  </div>;
}
