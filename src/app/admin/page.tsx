import { BookOpenCheck, FileStack, FileUp, LayoutDashboard, ListChecks } from "lucide-react";
import Link from "next/link";
import { ImportList } from "@/components/import-list";
import { Button } from "@/components/ui/button";
import { db } from "@/database";
import { drafts, imports, questions } from "@/database/schema";
import { recentImports } from "@/modules/imports";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin overview" };

export default async function AdminOverview() {
  const [papers, total, draftCount, published] = await Promise.all([recentImports(), db.$count(imports), db.$count(drafts), db.$count(questions)]);
  return <>
    <div className="admin-head"><div className="page-heading"><span className="tile-icon"><LayoutDashboard size={21} /></span><h1>Editorial overview</h1><p>Import PDFs and manage publication to the question bank.</p></div><Button asChild><Link href="/admin/imports/new"><FileUp size={16} />New import</Link></Button></div>
    <section className="metrics metrics-three" aria-label="Editorial counts">
      {[{ label: "PDF imports", value: total, icon: FileStack }, { label: "Staged questions", value: draftCount, icon: ListChecks }, { label: "Published questions", value: published, icon: BookOpenCheck }].map(({ label, value, icon: Icon }) => <article className="metric" key={label}><span className="tile-icon"><Icon size={17} /></span><div><strong>{value}</strong><span>{label}</span></div></article>)}
    </section>
    <section className="panel bank-panel"><h2>Recent imports</h2><ImportList items={papers.slice(0, 8)} /></section>
  </>;
}
