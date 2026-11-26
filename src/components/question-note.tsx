"use client";

import { ChevronDown, NotebookPen } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { saveNote } from "@/app/(student)/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function QuestionNote({ id, initial }: { id: string; initial: string }) {
  const initialText = initial.replace(/\r\n?/g, "\n");
  const [value, setValue] = useState(initialText);
  const [state, action, pending] = useActionState(saveNote.bind(null, id), {});
  const fieldId = useId();
  const saved = state.note ?? initialText;
  const changed = value.trim() !== saved;
  const feedback = pending ? "Saving…" : changed ? "Unsaved changes" : state.note === undefined ? "" : saved ? "Note saved." : "Note removed.";
  return <details className="group mt-4 rounded-xl border border-border bg-card text-card-foreground">
    <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5 [&::-webkit-details-marker]:hidden">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><NotebookPen size={17} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Study note</span>
        <span className="block truncate text-sm text-muted-foreground group-open:hidden">{saved || "Keep a reminder or your approach to this question."}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" aria-hidden="true" />
    </summary>
    <form action={action} className="grid gap-3 border-t border-border p-4 sm:p-5">
      <Textarea name="note" aria-label="Study note" aria-describedby={`${fieldId}-privacy`} value={value} maxLength={4000}
        placeholder="What would you want to remember when you see this question again?"
        readOnly={pending} onChange={(event) => setValue(event.target.value)} rows={4} />
      <p id={`${fieldId}-privacy`} className="text-xs text-muted-foreground">Private to this browser profile.</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="submit" size="sm" disabled={pending || !changed}>Save note</Button>
        <span role="status" className="text-sm text-muted-foreground">{!state.error && feedback}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{value.length.toLocaleString("en-GB")} / 4,000</span>
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  </details>;
}
