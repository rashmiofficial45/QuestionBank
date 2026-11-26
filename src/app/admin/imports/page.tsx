import { FileStack, FileUp } from "lucide-react";
import Link from "next/link";
import { ImportList } from "@/components/import-list";
import { Button } from "@/components/ui/button";
import { recentImports } from "@/modules/imports";

export const dynamic = "force-dynamic";
export const metadata = { title: "PDF imports" };

export default async function ImportsPage() {
  return <>
    <div className="admin-head"><div className="page-heading"><span className="tile-icon"><FileStack size={21} /></span><h1>PDF imports</h1><p>Follow processing and work through extracted drafts.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href="/admin/imports/data?mode=manual">Create question</Link></Button><Button variant="outline" asChild><Link href="/admin/imports/data">Import CSV or JSON</Link></Button><Button asChild><Link href="/admin/imports/new"><FileUp size={16} />New import</Link></Button></div></div>
    <section className="panel bank-panel"><div className="section-heading"><h2>Import history</h2><Link className="text-link" href="/admin/duplicates">Review duplicates</Link></div><ImportList items={await recentImports()} /></section>
  </>;
}
