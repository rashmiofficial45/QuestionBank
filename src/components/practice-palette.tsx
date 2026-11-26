"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

type Entry = { answered: boolean; marked: boolean; correct?: boolean };

export function PracticePalette({ id, index, entries, reviewing = false, previous, next }: {
  id: string; index: number; entries: Entry[]; reviewing?: boolean; previous?: string; next?: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const bar = rail.current;
    const current = active.current;
    if (!bar || !current) return;
    const item = current.getBoundingClientRect();
    const strip = bar.getBoundingClientRect();
    if (item.left < strip.left) bar.scrollLeft += item.left - strip.left;
    else if (item.right > strip.right) bar.scrollLeft += item.right - strip.right;
  }, [index]);
  const arrows = entries.length > 1;
  return <nav className="test-palette" aria-label="Jump to a test question">
    {arrows && (previous
      ? <Button asChild variant="ghost" size="icon-sm"><Link href={previous} replace aria-label="Previous question"><ChevronLeft /></Link></Button>
      : <Button variant="ghost" size="icon-sm" type="button" disabled aria-label="Previous question"><ChevronLeft /></Button>)}
    <div className="test-palette-scroll" ref={rail}>
      {entries.map(({ answered, marked, correct }, position) => {
        const selected = position === index;
        const status = correct !== undefined ? correct ? "correct" : "incorrect" : answered ? "answered" : "unanswered";
        return <Link className="test-step" data-state={status} data-marked={marked || undefined}
          href={`/practice/${id}?${reviewing ? "review=1&" : ""}q=${position + 1}`} ref={selected ? active : undefined} key={position}
          aria-current={selected ? "step" : undefined} aria-label={`Question ${position + 1}, ${status}${marked ? ", marked for review" : ""}`}
          prefetch={false} replace>{position + 1}</Link>;
      })}
    </div>
    {arrows && (next
      ? <Button asChild variant="ghost" size="icon-sm"><Link href={next} replace aria-label="Next question"><ChevronRight /></Link></Button>
      : <Button variant="ghost" size="icon-sm" type="button" disabled aria-label="Next question"><ChevronRight /></Button>)}
  </nav>;
}
