import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";
import { UploadForm } from "@/components/import-forms";

export const metadata = { title: "New PDF import" };
export default function NewImport() {
  return <>
    <Link className="text-link workspace-back" href="/admin/imports"><ArrowLeft size={16} /> PDF imports</Link>
    <div className="admin-head"><div className="page-heading"><span className="tile-icon"><FileUp size={21} /></span><h1>Import a question paper</h1><p>Add one questions PDF and one answers PDF, up to 10 MB each.</p></div></div>
    <section className="panel bank-panel"><UploadForm /></section>
  </>;
}
