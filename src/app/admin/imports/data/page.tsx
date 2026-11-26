import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuestionEntryForm } from "@/components/question-entry-forms";

export default async function DataEntry({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const manual = mode === "manual";
  return <>
    <Link className="text-link workspace-back" href="/admin/imports"><ArrowLeft size={16} /> Import history</Link>
    <div className="page-heading"><h1>{manual ? "Create a question" : "Import question data"}</h1>
      <p>{manual ? "Start a draft, then add answer options and a reference answer in Edit." : "Stage questions from a spreadsheet or an exported question file."}</p></div>
    <section className="panel bank-panel">
      {!manual && <p className="text-sm text-muted-foreground">CSV can use question, option_a, option_b, answer, and explanation. Export any existing import to see the full CSV and JSON formats.</p>}
      <QuestionEntryForm manual={manual} />
    </section>
  </>;
}
