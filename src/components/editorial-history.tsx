import Link from "next/link";
import { restoreOriginal, restoreRevision, setArchived } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importActivity, versionHistory } from "@/modules/imports";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export async function EditorialHistory({ importId, draft, stale }: {
  importId: string;
  draft?: { id: string; generation: number; number: number; published: string | null; archivedAt: Date | null };
  stale: boolean;
}) {
  const [events, versions] = await Promise.all([importActivity(importId), draft?.published ? versionHistory(draft.published) : []]);
  return <>
    <section className="panel bank-panel admin-section">
      <h2>Revision history{draft ? ` for question ${draft.number}` : ""}</h2>
      {stale && <p role="alert" className="form-error">The draft changed. Review the latest state before restoring a revision.</p>}
      {draft && <form className="form-actions" action={restoreOriginal.bind(null, importId, draft.id, draft.generation)}>
        <Button type="submit" variant="outline">Restore original content to draft</Button>
      </form>}
      {!versions.length && <p className="empty">Published versions will appear here.</p>}
      {draft && versions.length > 0 && <>
        <div className="form-actions">
          <form action={setArchived.bind(null, importId, draft.id, !draft.archivedAt)}>
            <Button type="submit" variant="outline">{draft.archivedAt ? "Return to question bank" : "Archive question"}</Button>
          </form>
        </div>
        <Table className="mt-3" aria-label="Published revisions">
          <TableHeader><TableRow><TableHead>Revision</TableHead><TableHead>Classification</TableHead><TableHead>Published</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>{versions.map((version) => <TableRow key={version.revision}>
            <TableCell>{version.revision}</TableCell><TableCell>{version.subject} · {version.topic}</TableCell>
            <TableCell>{dateFormat.format(version.createdAt)}</TableCell>
            <TableCell><form action={restoreRevision.bind(null, importId, draft.id, version.revision, draft.generation)}>
              <Button type="submit" variant="outline" size="sm">Restore revision {version.revision} to draft</Button>
            </form></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </>}
    </section>
    <section className="panel bank-panel admin-section">
      <h2>Editorial activity</h2>
      {!events.length ? <p className="empty">Activity will appear after the next editorial change.</p> :
        <Table className="mt-3" aria-label="Editorial activity">
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Question</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>{events.map((event) => <TableRow key={event.id}>
            <TableCell>{dateFormat.format(event.createdAt)}</TableCell><TableCell>{event.type}</TableCell>
            <TableCell>{event.questionNumber ? <Link className="text-link" href={`/admin/imports/${importId}?mode=history&q=${event.questionNumber}`}>Question {event.questionNumber}</Link> : "Entire import"}</TableCell>
            <TableCell>{event.detail}</TableCell>
          </TableRow>)}</TableBody>
        </Table>}
    </section>
  </>;
}
