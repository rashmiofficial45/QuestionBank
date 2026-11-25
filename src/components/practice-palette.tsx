"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

type Entry = { answered: boolean; marked: boolean; correct?: boolean };

export function PracticePalette({ id, index, entries, reviewing = false }: { id: string; index: number; entries: Entry[]; reviewing?: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const bar = rail.current;
    const current = active.current;
    if (!bar || !current) return;
    if (current.offsetLeft < bar.scrollLeft || current.offsetLeft + current.offsetWidth > bar.scrollLeft + bar.clientWidth) {
      bar.scrollLeft = current.offsetLeft - (bar.clientWidth - current.offsetWidth) / 2;
    }
  }, [index]);
  const scroll = (direction: -1 | 1) => {
    if (rail.current) rail.current.scrollBy({ left: direction * rail.current.clientWidth * 0.85, behavior: "auto" });
  };
  return <nav className="test-palette" aria-label="Jump to a test question">
    {entries.length > 7 && <Button variant="ghost" size="icon-sm" type="button" onClick={() => scroll(-1)} aria-label="Scroll to earlier questions"><ChevronLeft /></Button>}
    <div className="test-palette-scroll" ref={rail}>
      {entries.map(({ answered, marked, correct }, position) => {
        const selected = position === index;
        const status = correct !== undefined ? correct ? "correct" : "incorrect" : answered ? "answered" : "unanswered";
        return <Link className="test-step" data-state={status} data-marked={marked || undefined}
          href={`/practice/${id}?${reviewing ? "review=1&" : ""}q=${position + 1}`} ref={selected ? active : undefined} key={position}
          aria-current={selected ? "step" : undefined} aria-label={`Question ${position + 1}, ${status}${marked ? ", marked for review" : ""}`}
          prefetch={false}>{position + 1}</Link>;
      })}
    </div>
    {entries.length > 7 && <Button variant="ghost" size="icon-sm" type="button" onClick={() => scroll(1)} aria-label="Scroll to later questions"><ChevronRight /></Button>}
  </nav>;
}
