import { Target } from "lucide-react";
import { redirect } from "next/navigation";
import { browse } from "@/modules/study";

export const dynamic = "force-dynamic";
export default async function Practice() {
  const { items } = await browse();
  if (items[0]) redirect(`/questions/${items[0].slug}?practice=1`);
  return <><div className="page-heading"><span className="tile-icon violet"><Target size={21} /></span><h1>Practice</h1><p>Published questions will appear here when they are ready for practice.</p></div></>;
}
