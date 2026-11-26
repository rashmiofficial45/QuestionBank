import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/database";
import { questions, questionVersions, studyDrills, studyRevision } from "@/database/schema";
import { getProfile } from "@/modules/study";
import { AnswerForm } from "@/components/answer-form";
import { Button } from "@/components/ui/button";
import { QuestionContent } from "@/components/question-content";
import { markRevision, setBookmark } from "../../../actions";
import { finishDrill } from "../actions";
import { bookmarkIds } from "@/modules/study";

export default async function DrillSession({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }>;
}) {
  const [{ id }, query, profile] = await Promise.all([params, searchParams, getProfile()]);
  if (!profile || !z.uuid().safeParse(id).success) notFound();
  const [drill] = await db.select().from(studyDrills).where(and(eq(studyDrills.id, id), eq(studyDrills.profileId, profile)));
  if (!drill) notFound();
  const done = Object.values(drill.responses);
  const answered = done.filter((item) => item.answered).length;
  const correct = done.filter((item) => item.correct === true).length;
  const incorrect = done.filter((item) => item.correct === false).length;
  const path = `/practice/drill/${id}`;
  if (drill.submittedAt && !query.q) return <section className="panel bank-panel">
    <div className="page-heading"><h1>Practice complete</h1></div>
    <p>{answered} answered · {correct} correct · {incorrect} incorrect · {drill.manifest.length - answered} skipped</p>
    <div className="form-actions"><Button asChild><Link href={`${path}?q=1`}>Review answers</Link></Button><Button asChild variant="outline"><Link href="/practice/drill">Back to practice sets</Link></Button></div>
  </section>;
  const firstOpen = drill.manifest.findIndex((item) => !drill.responses[item.id]);
  const fallback = firstOpen < 0 ? 1 : firstOpen + 1;
  const number = typeof query.q === "string" && /^\d+$/.test(query.q) ? Math.min(Math.max(1, Number(query.q)), drill.manifest.length) : fallback;
  const pinned = drill.manifest[number - 1];
  const [question] = await db.select({ content: questionVersions.content, importId: questions.importId })
    .from(questionVersions).innerJoin(questions, eq(questions.id, questionVersions.questionId))
    .where(and(eq(questionVersions.questionId, pinned.id), eq(questionVersions.revision, pinned.revision)));
  if (!question) notFound();
  const [saved, marked] = await Promise.all([bookmarkIds(),
    db.$count(studyRevision, and(eq(studyRevision.profileId, profile), eq(studyRevision.questionId, pinned.id)))]);
  const previous = drill.responses[pinned.id];
  const content = question.content;
  return <section className="panel bank-panel">
    <div className="section-heading"><div><h1 className="text-2xl font-semibold">Question {number} of {drill.manifest.length}</h1>
      <p>{answered} answered · {correct} correct</p></div></div>
    <div className="mb-4 flex flex-wrap gap-2">
      <form action={setBookmark.bind(null, pinned.id, !saved.has(pinned.id))}><Button variant="outline">{saved.has(pinned.id) ? "Remove bookmark" : "Bookmark"}</Button></form>
      <form action={markRevision.bind(null, pinned.id, !marked)}><Button variant="outline">{marked ? "Unmark for revision" : "Mark for revision"}</Button></form>
    </div>
    <QuestionContent blocks={content.blocks} importId={question.importId} testSessionId={id} />
    <AnswerForm key={pinned.id} drillId={id} id={pinned.id} revision={pinned.revision} interaction={content.interaction} options={content.options}
      importId={question.importId} testSessionId={id} prompts={content.interaction === "pair_matching" ? content.prompts : undefined}
      initialResult={previous?.answered || drill.submittedAt ? { answer: content.answer ?? undefined, selected: previous?.selected, correct: previous?.correct, explanation: content.explanation } : undefined} />
    <div className="form-actions">
      {number > 1 && <Button asChild variant="outline"><Link href={`${path}?q=${number - 1}`}>Previous</Link></Button>}
      {number < drill.manifest.length && <Button asChild variant="outline"><Link href={`${path}?q=${number + 1}`}>Next question</Link></Button>}
      {drill.submittedAt ? <Button asChild><Link href={path}>Back to practice summary</Link></Button> : <form action={finishDrill.bind(null, id)}><Button>Finish practice</Button></form>}
    </div>
  </section>;
}
