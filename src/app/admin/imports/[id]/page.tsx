import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Eye, FileText, Pencil, Send } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { QuestionContent } from "@/components/question-content";
import { EditForm, RefreshImport } from "@/components/import-forms";
import { ImportStatus } from "@/components/import-list";
import { publicationIssues, questionSchema } from "@/lib/content";
import { getDrafts, getImport } from "@/modules/imports";
import { publishImport } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import results" };

export default async function ImportDetails({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string; q?: string; published?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const paper = await getImport(id);
  if (!paper) notFound();
  const rows = paper.status === "ready" ? await getDrafts(id) : [];
  const checked = rows.map((draft) => {
    const parsed = questionSchema.safeParse(draft.content);
    return { ...draft, blockers: [...new Set([...draft.issues, ...(parsed.success ? publicationIssues(parsed.data) : ["Draft content needs correction."])])] };
  });
  const selectedIndex = Math.max(0, checked.findIndex((draft) => String(draft.number) === query.q));
  const selected = checked[selectedIndex];
  const eligible = checked.filter((draft) => !draft.published && !draft.blockers.length);
  const published = checked.filter((draft) => draft.published).length;
  const flagged = checked.filter((draft) => draft.blockers.length);
  const base = `/admin/imports/${id}`;
  const mode = query.mode === "review" || query.mode === "edit" || query.mode === "publish" ? query.mode : "";
  const draftLink = (number: number, kind = mode) => `${base}?mode=${kind}&q=${number}`;
  return <>
    <Link className="text-link" href="/admin/imports"><ArrowLeft size={16} /> PDF imports</Link>
    <div className="admin-head"><div className="page-heading"><span className="tile-icon violet"><FileText size={21} /></span><h1>{paper.title}</h1><p>{paper.subject} · {paper.paperName}</p></div><ImportStatus value={paper.status} /></div>
    {paper.status !== "ready" ? <section className="panel bank-panel" aria-live="polite"><h2>{paper.stage}</h2>{paper.error && <p className="form-error">{paper.error}</p>}{["queued", "processing"].includes(paper.status) && <RefreshImport />}</section> : <>
      <section className="panel bank-panel">
        <h2>Import results</h2>
        <p className="results-label">{checked.length} extracted · {eligible.length} ready to publish · {flagged.length} flagged · {published} published</p>
        {typeof query.published === "string" && /^\d+$/.test(query.published) && <p className="notice" role="status">{query.published === "0" ? "No new questions were published." : `${query.published} questions published to the student bank.`}</p>}
        <div className="form-actions">
          <Button variant={mode === "review" ? "default" : "outline"} asChild><Link href={draftLink(selected?.number ?? 1, "review")}><Eye size={17} />Review</Link></Button>
          <Button variant={mode === "edit" ? "default" : "outline"} asChild><Link href={draftLink(selected?.number ?? 1, "edit")}><Pencil size={16} />Edit</Link></Button>
          <Button variant={mode === "publish" ? "outline" : "default"} asChild><Link href={`${base}?mode=publish&q=${selected?.number ?? 1}`}><Send size={16} />Publish</Link></Button>
        </div>
      </section>
      {mode === "publish" && <section className="panel bank-panel admin-section"><h2>Publication summary</h2>
        <p className="notice">{eligible.length} validated questions can be added to the student bank. {flagged.length} flagged questions require corrections.</p>
        {!!flagged.length && <p><Link className="text-link" href={draftLink(flagged[0].number, "review")}>Go to first flagged question <ArrowRight size={16} /></Link></p>}
        <div className="form-actions">
          <form action={publishImport.bind(null, id)}><Button disabled={!eligible.length} type="submit"><Send size={16} />Publish {eligible.length} {eligible.length === 1 ? "question" : "questions"}</Button></form>
          {selected && eligible.some((draft) => draft.id === selected.id) && <form action={publishImport.bind(null, id)}><input type="hidden" name="draft" value={selected.id} /><Button variant="outline" type="submit">Publish question {selected.number}</Button></form>}
        </div>
      </section>}
      {selected && (mode === "review" || mode === "edit") && <>
        <section className="panel bank-panel admin-section">
          <div className="question-nav"><h2>{mode === "review" ? "Review extracted questions" : "Edit draft questions"}</h2>{flagged.length > 0 && <Link className="text-link" href={draftLink(flagged[0].number)}>First flagged <ArrowRight size={14} /></Link>}</div>
          <div className="question-index" aria-label="Question numbers">{checked.map((draft) => <Link key={draft.id} href={draftLink(draft.number)} aria-current={draft.id === selected.id ? "page" : undefined} aria-label={`Question ${draft.number}${draft.blockers.length ? ", flagged" : ""}`} data-flagged={Boolean(draft.blockers.length)}>{draft.number}</Link>)}</div>
        </section>
        <div className="review-layout">
          <section className="panel bank-panel">
            <div className="section-heading"><div><h2>Original paper</h2><p>PDF page {selected.page}</p></div><a className="text-link" target="_blank" rel="noreferrer" href={`/api/v1/source/${id}/paper.pdf#page=${selected.page}`}>Open PDF <ArrowUpRight size={15} /></a></div>
            <iframe className="pdf-preview" key={selected.page} title={`Original paper, page ${selected.page}`} src={`/api/v1/source/${id}/paper.pdf#page=${selected.page}&toolbar=1`} />
          </section>
          <section className="panel bank-panel">
            <div className="section-heading"><h2>Question {selected.number}</h2><span className={`pill ${selected.blockers.length ? "pill-error" : "pill-success"}`}>{selected.published ? "Published" : selected.blockers.length ? "Flagged" : "Validated"}</span></div>
            {selected.blockers.length > 0 && <ul className="form-error">{selected.blockers.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
            {mode === "edit" && !selected.published ? <EditForm key={selected.id} content={selected.content} importId={id} id={selected.id} issues={selected.issues} />
              : <>{mode === "edit" && <p className="notice">This question is published. Revision editing is planned for a later milestone.</p>}
                <QuestionContent blocks={selected.content.blocks} importId={id} administrative />
                <ul className="review-options">{selected.content.options.map((option, index) => <li key={`${option.id}-${index}`} className={`review-option ${selected.content.answer === option.id ? "correct" : ""}`}><strong>{option.label}.</strong> {option.text} {selected.content.answer === option.id && <Check size={14} className="inline" aria-label="Correct answer" />}</li>)}</ul>
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
  </>;
}
