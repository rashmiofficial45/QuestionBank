import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";
import { UploadForm } from "@/components/import-forms";

export const metadata = { title: "New PDF import" };
export default function NewImport() {
  return <>
    <Link className="text-link" href="/admin/imports"><ArrowLeft size={16} /> PDF imports</Link>
    <div className="page-heading"><span className="tile-icon violet"><FileUp size={21} /></span><h1>Import a question paper</h1><p>Upload the original paper with its separate answer key. Each PDF has a 10 MB limit.</p></div>
    <section className="panel bank-panel"><h2>Source documents</h2><UploadForm /></section>
  </>;
}
