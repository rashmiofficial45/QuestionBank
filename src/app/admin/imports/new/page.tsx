import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";
import { UploadForm } from "@/components/import-forms";

export const metadata = { title: "New PDF import" };
export default function NewImport() {
  return <>
    <Link className="text-link workspace-back" href="/admin/imports"><ArrowLeft size={16} /> PDF imports</Link>
    <div className="admin-head"><div className="page-heading"><span className="tile-icon"><FileUp size={21} /></span><h1>Import a question paper</h1><p>Upload a combined PDF or a paper with its separate answer key. Each PDF has a 10 MB limit.</p></div></div>
    <section className="panel bank-panel"><h2>Source documents</h2><UploadForm /></section>
  </>;
}
