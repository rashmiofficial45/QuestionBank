import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Eye, FileText, History, Pencil, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EditorialHistory } from "@/components/editorial-history";
import { Button } from "@/components/ui/button";
import { OptionContent } from "@/components/option-content";
import { QuestionContent } from "@/components/question-content";
import { EditForm, RefreshImport } from "@/components/import-forms";
import { ImportStatus } from "@/components/import-list";
import { publicationIssues, questionSchema } from "@/lib/content";
import { choiceIds } from "@/lib/choice-selection";
import { isRanked } from "@/lib/ranked-answer";
import { isWritten } from "@/lib/written-answer";
import { rankedLabels } from "@/components/ranked-fields";
import { getDrafts, getImport, hasExplanationPDF } from "@/modules/imports";
import { publishImport, retryImport } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import results" };

export default async function ImportDetails({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string; q?: string; published?: string; stale?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const paper = await getImport(id);
  if (!paper) notFound();
  const explanationPDF = await hasExplanationPDF(id);
  const rows = paper.status === "ready" ? await getDrafts(id) : [];
  const checked = rows.map((draft) => {
    const parsed = questionSchema.safeParse(draft.content);
    return { ...draft, blockers: [...new Set([...draft.issues, ...(parsed.success ? publicationIssues(parsed.data) : ["Draft content needs correction."])])] };
  });
  const selectedIndex = Math.max(0, checked.findIndex((draft) => String(draft.number) === query.q));
  const selected = checked[selectedIndex];
  const eligible = checked.filter((draft) => !draft.archivedAt && draft.generation !== draft.publishedGeneration && !draft.blockers.length);
  const published = checked.filter((draft) => draft.published && !draft.archivedAt).length;
  const flagged = checked.filter((draft) => draft.blockers.length);
  const tableCount = checked.flatMap((draft) => draft.content.blocks).filter((block) => block.type === "table").length;
  const base = `/admin/imports/${id}`;
  const mode = query.mode === "review" || query.mode === "edit" || query.mode === "publish" || query.mode === "history" ? query.mode : "";
  const draftLink = (number: number, kind = mode) => `${base}?mode=${kind}&q=${number}`;
  return <>
    <Link className="text-link workspace-back" href="/admin/imports"><ArrowLeft size={16} /> PDF imports</Link>
    <div className="admin-head"><div className="page-heading"><span className="tile-icon"><FileText size={21} /></span><h1>{paper.title}</h1><p>{paper.subject} · {paper.paperName}</p></div><ImportStatus value={paper.status} /></div>
    {paper.status !== "ready" ? <section className="panel bank-panel" aria-live="polite"><h2>{paper.stage}</h2>{paper.error && <p className="form-error">{paper.error}</p>}{paper.status === "failed" && <form className="form-actions" action={retryImport.bind(null, id)}><Button type="submit" variant="outline"><RefreshCw />Retry import</Button></form>}{["queued", "processing"].includes(paper.status) && <RefreshImport />}
        <Link className="text-link mt-3" href={mode === "history" ? base : `${base}?mode=history`}>{mode === "history" ? "Hide activity" : "View editorial activity"}</Link>
      </section> : <>
      <section className="panel bank-panel">
        <h2>Import results</h2>
        <p className="results-label">{checked.length} extracted · {eligible.length} ready to publish · {flagged.length} flagged · {published} published</p>
        <p className="results-label">{tableCount} structured {tableCount === 1 ? "table" : "tables"}</p>
        {typeof query.published === "string" && /^\d+$/.test(query.published) && <p className="notice" role="status">{query.published === "0" ? "No new questions were published." : `${query.published} ${query.published === "1" ? "question" : "questions"} published to the student bank.`}</p>}
        <div className="form-actions">
          <Button className="transition-none" variant={mode === "review" ? "default" : "outline"} asChild><Link aria-current={mode === "review" ? "page" : undefined} href={draftLink(selected?.number ?? 1, "review")}><Eye size={17} />Review</Link></Button>
          <Button className="transition-none" variant={mode === "edit" ? "default" : "outline"} asChild><Link aria-current={mode === "edit" ? "page" : undefined} href={draftLink(selected?.number ?? 1, "edit")}><Pencil size={16} />Edit</Link></Button>
          <Button className="transition-none" variant={mode === "publish" ? "outline" : "default"} asChild><Link aria-current={mode === "publish" ? "page" : undefined} href={`${base}?mode=publish&q=${selected?.number ?? 1}`}><Send size={16} />Publish</Link></Button>
          <Button className="transition-none" variant={mode === "history" ? "default" : "outline"} asChild><Link aria-current={mode === "history" ? "page" : undefined} href={draftLink(selected?.number ?? 1, "history")}><History size={16} />History</Link></Button>
        </div>
      </section>
      {mode === "publish" && <section className="panel bank-panel admin-section"><h2>Publication summary</h2>
        <p className="notice">{eligible.length} questions or revisions are ready for publication. {flagged.length} flagged questions require corrections.</p>
        {!!flagged.length && <p><Link className="text-link" href={draftLink(flagged[0].number, "review")}>Go to first flagged question <ArrowRight size={16} /></Link></p>}
        <div className="form-actions">
          <form action={publishImport.bind(null, id)}><Button disabled={!eligible.length} type="submit"><Send size={16} />Publish {eligible.length} {eligible.length === 1 ? "question" : "questions"}</Button></form>
          {selected && eligible.some((draft) => draft.id === selected.id) && <form action={publishImport.bind(null, id)}><input type="hidden" name="draft" value={selected.id} /><Button variant="outline" type="submit">Publish question {selected.number}</Button></form>}
        </div>
        {eligible.length > 1 && <form action={publishImport.bind(null, id)} className="admin-section">
          <input name="scope" type="hidden" value="selected" />
          <fieldset className="grid gap-2"><legend className="mb-2 font-semibold">Select questions to publish</legend>
            <div className="question-index">{eligible.map((row) => <label className="flex items-center gap-2 rounded-md border px-2 py-1" key={row.id}><input type="checkbox" name="draft" value={row.id} />Question {row.number}</label>)}</div>
          </fieldset>
          <Button type="submit" variant="outline">Publish selected</Button>
        </form>}
      </section>}
      {selected && (mode === "review" || mode === "edit") && <>
        <section className="panel bank-panel admin-section">
          <div className="question-nav"><h2>{mode === "review" ? "Review extracted questions" : "Edit draft questions"}</h2>{flagged.length > 0 && <Link className="text-link" href={draftLink(flagged[0].number)}>First flagged <ArrowRight size={14} /></Link>}</div>
          <div className="question-index" aria-label="Question numbers">{checked.map((draft) => <Link key={draft.id} href={draftLink(draft.number)} aria-current={draft.id === selected.id ? "page" : undefined} aria-label={`Question ${draft.number}${draft.blockers.length ? ", flagged" : ""}`} data-flagged={Boolean(draft.blockers.length)}>{draft.number}</Link>)}</div>
        </section>
        <div className="review-layout">
          <section className="panel bank-panel">
            <div className="section-heading"><div><h2>Original paper</h2><p>PDF page {selected.page}</p></div><a className="text-link" target="_blank" rel="noreferrer" href={`/api/v1/source/${id}/paper.pdf#page=${selected.page}`}>Open PDF <ArrowUpRight size={15} /></a></div>
            {paper.keyName && <a className="text-link mb-3" target="_blank" rel="noreferrer" href={`/api/v1/source/${id}/key.pdf`}>Open answer key <ArrowUpRight size={15} /></a>}
            {explanationPDF && <a className="text-link mb-3" target="_blank" rel="noreferrer" href={`/api/v1/source/${id}/explanations.pdf`}>Open explanation PDF <ArrowUpRight size={15} /></a>}
            <iframe className="pdf-preview" key={selected.page} title={`Original paper, page ${selected.page}`} src={`/api/v1/source/${id}/paper.pdf#page=${selected.page}&toolbar=1`} />
          </section>
          <section className="panel bank-panel">
            <div className="section-heading"><h2>Question {selected.number}</h2><span className={`pill ${selected.blockers.length ? "pill-error" : "pill-success"}`}>{selected.archivedAt ? "Archived" : selected.blockers.length ? "Flagged" : selected.published && selected.publishedGeneration === selected.generation ? `Published · v${selected.publishedRevision}` : selected.published ? "Unpublished revision" : "Validated"}</span></div>
            {selected.blockers.length > 0 && <ul className="form-error">{selected.blockers.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
            {mode === "edit" ? <>
              {selected.published && <p className="notice">Changes are saved to a draft. Students see revision {selected.publishedRevision} until you publish again.</p>}
              <EditForm key={selected.id} content={selected.content} importId={id} id={selected.id} issues={selected.issues} generation={selected.generation}
                classification={{ subject: selected.subject ?? paper.subject, topic: selected.topic ?? "General", difficulty: selected.difficulty ?? "Unrated", tags: selected.tags }} />
              </> : <>
                <QuestionContent blocks={selected.content.blocks} importId={id} administrative />
                {isWritten(selected.content.interaction) ? <p className="notice whitespace-pre-wrap"><strong>Reference answer</strong> {selected.content.answer}</p>
                : isRanked(selected.content.interaction) ? <p className="notice whitespace-pre-wrap"><strong>Reference sequence</strong>{"\n"}{
                  rankedLabels(selected.content.options, choiceIds(selected.content.answer), selected.content.interaction === "pair_matching" ? selected.content.prompts : undefined)
                }</p> : <ul className="review-options">{selected.content.options.map((option, index) => {
                  const correct = choiceIds(selected.content.answer).includes(option.id);
                  return <li key={`${option.id}-${index}`} className={`review-option ${correct ? "correct" : ""}`}><strong>{option.label}.</strong> <OptionContent option={option} importId={id} administrative /> {correct && <Check size={14} className="inline" aria-label="Correct answer" />}</li>;
                })}</ul>}
                {selected.content.explanation && <p className="notice">{selected.content.explanation}</p>}
              </>}
            <div className="question-nav admin-section">
              {selectedIndex > 0 ? <Link className="text-link" href={draftLink(checked[selectedIndex - 1].number)}><ArrowLeft size={15} />Previous</Link> : <span />}
              {selectedIndex + 1 < checked.length && <Link className="text-link" href={draftLink(checked[selectedIndex + 1].number)}>Next<ArrowRight size={15} /></Link>}
            </div>
          </section>
        </div>
      </>}
    </>}
    {mode === "history" && <EditorialHistory importId={id} draft={selected} stale={query.stale === "1"} />}
  </>;
}
