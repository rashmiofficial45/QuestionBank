import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { imports } from "@/database/schema";

export function ImportStatus({ value }: { value: string }) {
  const text = { queued: "Queued", processing: "Processing", ready: "Drafts ready", failed: "Failed" }[value] ?? value;
  return <Badge className="import-status" data-status={value} variant="outline"><span aria-hidden="true" />{text}</Badge>;
}

export function ImportList({ items }: { items: (typeof imports.$inferSelect)[] }) {
  return <div className="admin-table">
    {items.length === 0 && <p className="empty">Uploaded papers will appear here.</p>}
    {items.map((item) => <Link className="import-row" href={`/admin/imports/${item.id}`} key={item.id}>
      <span className="tile-icon" aria-hidden="true"><FileText size={18} /></span>
      <span className="import-row-title"><strong>{item.title}</strong><small>{item.subject} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(item.createdAt)}</small></span>
      <ImportStatus value={item.status} /><ChevronRight className="import-row-arrow" size={16} aria-hidden="true" />
    </Link>)}
  </div>;
}
