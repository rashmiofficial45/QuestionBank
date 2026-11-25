import { ArrowUpRight, BookOpen, Landmark, Globe2, Leaf, TrendingUp, ScrollText, FlaskConical } from "lucide-react";
import Link from "next/link";
import type { QuestionSummary } from "@/modules/study";

const icons = { Polity: Landmark, Geography: Globe2, Environment: Leaf, Economy: TrendingUp, History: ScrollText, Science: FlaskConical };

export function SubjectIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] ?? BookOpen;
  return <Icon size={size} strokeWidth={1.7} />;
}

export function QuestionList({ items, empty = "No questions match these filters." }: { items: QuestionSummary[]; empty?: string }) {
  return <div className="question-list">
    {items.length === 0 && <p className="empty">{empty}</p>}
    {items.map((item) => <Link key={item.id} href={`/questions/${item.slug}`} className="question-row">
      <span className="row-number">{String(item.number).padStart(2, "0")}</span>
      <span className="row-main"><strong>{item.searchText.split("\n")[0]}</strong><span>{item.subject} <span aria-hidden>·</span> {item.topic} <span aria-hidden>·</span> {item.source}</span></span>
      {item.difficulty !== "Unrated" && <span className={`pill difficulty-${item.difficulty.toLowerCase()}`}>{item.difficulty}</span>}
      <ArrowUpRight size={17} className="row-arrow" />
    </Link>)}
  </div>;
}
