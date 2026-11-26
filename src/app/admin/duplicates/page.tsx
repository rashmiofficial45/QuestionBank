import Link from "next/link";
import { keepDuplicates, suppressDuplicate } from "@/app/admin/duplicate-actions";
import { Button } from "@/components/ui/button";
import { duplicateGroups } from "@/modules/duplicates";
import { displayText } from "@/modules/study";

export default async function DuplicatesPage() {
  const groups = await duplicateGroups();
  return <>
    <div className="page-heading"><h1>Duplicate questions</h1><p>Compare questions with the same prompt and answer choices across imports.</p></div>
    {!groups.length && <p className="panel bank-panel">No unresolved duplicate groups.</p>}
    {groups.map(({ key, rows }) => <section key={key} className="panel bank-panel admin-section">
      <h2 className="break-words">{displayText(rows[0].content).slice(0, 180)}</h2>
      {rows.map((row) => <div className="flex flex-wrap items-center justify-between gap-2 border-t py-3" key={row.id}>
        <Link className="text-link whitespace-normal" href={`/admin/imports/${row.importId}?mode=review&q=${row.number}`}>{row.title} · Question {row.number} · {row.published ? "Published" : "Draft"}</Link>
        <form action={suppressDuplicate.bind(null, row.id, key)}><Button size="sm" variant="outline">Exclude duplicate</Button></form>
      </div>)}
      <form action={keepDuplicates.bind(null, key)}><Button size="sm">Keep these questions</Button></form>
    </section>)}
  </>;
}
