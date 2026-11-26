"use client";

import { useActionState, useState } from "react";
import { saveNote } from "@/app/(student)/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function QuestionNote({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, action, pending] = useActionState(saveNote.bind(null, id), {});
  return <details className="panel source-text">
    <summary>Study note</summary>
    <form action={action} className="mt-3 grid gap-2">
      <Textarea name="note" aria-label="Study note" value={value} maxLength={4000} onChange={(event) => setValue(event.target.value)} rows={4} />
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" disabled={pending}>Save note</Button>
        <span role="status" className="text-sm text-muted-foreground">{state.error ?? (state.saved ? "Note saved." : "")}</span>
      </div>
    </form>
  </details>;
}
