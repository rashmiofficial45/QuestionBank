import { FileStack, FileUp } from "lucide-react";
import Link from "next/link";
import { ImportList } from "@/components/import-list";
import { Button } from "@/components/ui/button";
import { recentImports } from "@/modules/imports";

export const dynamic = "force-dynamic";
export const metadata = { title: "PDF imports" };

export default async function ImportsPage() {
  return <>
    <div className="admin-head"><div className="page-heading"><span className="tile-icon violet"><FileStack size={21} /></span><h1>PDF imports</h1><p>Follow processing and work through extracted drafts.</p></div><Button asChild><Link href="/admin/imports/new"><FileUp size={16} />New import</Link></Button></div>
    <section className="panel bank-panel"><h2>Import history</h2><ImportList items={await recentImports()} /></section>
  </>;
}
