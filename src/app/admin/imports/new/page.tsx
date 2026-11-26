import { ArrowLeft, FileScan, FileUp, SearchCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { UploadForm } from "@/components/import-forms";

export const metadata = { title: "New PDF import" };
export default function NewImport() {
  return <>
    <Link className="text-link workspace-back" href="/admin/imports"><ArrowLeft size={16} /> PDF imports</Link>
    <div className="admin-head"><div className="page-heading"><span className="tile-icon"><FileUp size={21} /></span><h1>Import a question paper</h1><p>Add the paper and its detailed answer PDF. Each file can be up to 10 MB.</p></div></div>
    <div className="admin-upload-layout">
      <section className="panel bank-panel"><h2>Source documents</h2><UploadForm /></section>
      <aside className="panel bank-panel admin-upload-guide" aria-labelledby="import-guide">
        <h2 id="import-guide">After upload</h2>
        <ul>
          <li><FileScan aria-hidden="true" /><div><strong>Extract the paper</strong><p>Image-only pages use OCR.</p></div></li>
          <li><SearchCheck aria-hidden="true" /><div><strong>Verify flagged drafts</strong><p>Compare scanned text, tables, and answer labels with the original PDF.</p></div></li>
          <li><ShieldCheck aria-hidden="true" /><div><strong>Publish verified questions</strong><p>Drafts stay private until you publish them.</p></div></li>
        </ul>
      </aside>
    </div>
  </>;
}
