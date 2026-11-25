import Link from "next/link";
import type { imports } from "@/database/schema";

export function ImportStatus({ value }: { value: string }) {
  const text = { queued: "Queued", processing: "Processing", ready: "Drafts ready", failed: "Failed" }[value] ?? value;
  return <span className={`pill ${value === "ready" ? "pill-success" : value === "failed" ? "pill-error" : ""}`}>{text}</span>;
}

export function ImportList({ items }: { items: (typeof imports.$inferSelect)[] }) {
  return <div className="admin-table">
    {items.length === 0 && <p className="empty">Uploaded papers will appear here.</p>}
    {items.map((item) => <Link className="import-row" href={`/admin/imports/${item.id}`} key={item.id}><span><strong>{item.title}</strong><small>{item.subject} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(item.createdAt)}</small></span><ImportStatus value={item.status} /></Link>)}
  </div>;
}
