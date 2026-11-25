"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Flag, Timer, Trash2, X } from "lucide-react";
import { deleteTestReview, finishPractice, saveResponse, startPractice } from "@/app/(student)/practice/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Content } from "@/lib/content";
import type { TestResponse } from "@/database/schema";

export function PracticeSetup({ papers }: { papers: { name: string }[] }) {
  const [state, action, pending] = useActionState(startPractice, {});
  return <form action={action} className="grid max-w-lg gap-4">
    <label className="field">Paper<NativeSelect name="source" aria-label="Paper" defaultValue={papers.length === 1 ? papers[0].name : ""}>
      <NativeSelectOption value="">All published questions</NativeSelectOption>{papers.map(({ name }) => <NativeSelectOption key={name}>{name}</NativeSelectOption>)}
    </NativeSelect></label>
    <div className="field-grid">
      <label className="field">Duration (minutes)<Input name="minutes" type="number" defaultValue={60} min={1} max={180} required /></label>
      <label className="field">Marks per correct answer<Input name="marks" type="number" defaultValue={2} min={1} max={10} required /></label>
    </div>
    <label className="field">Wrong answer penalty<NativeSelect name="penalty" aria-label="Wrong answer penalty"><NativeSelectOption value="third">One-third of the marks</NativeSelectOption><NativeSelectOption value="none">No penalty</NativeSelectOption></NativeSelect></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <Button className="justify-self-start" disabled={pending}>{pending ? "Starting…" : "Start test"}</Button>
  </form>;
}

export function TestTimer({ id, seconds, unanswered }: { id: string; seconds: number; unanswered: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const form = useRef<HTMLFormElement>(null);
  const auto = useRef(false);
  useEffect(() => {
    const finishAt = Date.now() + seconds * 1000;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((finishAt - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [seconds]);
  useEffect(() => {
    if (!remaining && !auto.current) {
      auto.current = true;
      form.current?.requestSubmit();
    }
  }, [remaining]);
  const show = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return <div className="flex flex-wrap items-center gap-3">
    <span className="flex items-center gap-2 text-sm tabular-nums" aria-label="Time remaining"><Timer size={16} />{show}</span>
    <form action={finishPractice.bind(null, id)} ref={form} onSubmit={(event) => {
      if (!auto.current && !window.confirm(`Submit this test? ${unanswered} unanswered.`)) event.preventDefault();
    }}><Button type="submit">Submit test</Button></form>
  </div>;
}

export function TestOptions({ id, questionId, options, response, answer, ended }: {
  id: string; questionId: string; options: Content["options"]; response: TestResponse; answer?: string | null; ended: boolean;
}) {
  const [state, action, pending] = useActionState(saveResponse.bind(null, id, questionId), {});
  return <form action={action} className="test-options">
    <fieldset disabled={ended || pending} className="answer-form">
      <legend>{ended ? "Answer review" : "Select one answer"}</legend>
      {options.map((option) => {
        const selected = response.option === option.id;
        const correct = ended && answer === option.id;
        const wrong = ended && selected && !correct;
        return <Button key={option.id} type="submit" variant="outline" name="option" value={option.id} aria-pressed={selected}
          className={`option inline-option test-choice ${correct ? "option-correct" : wrong ? "option-incorrect" : selected ? "option-selected" : ""}`}>
          <span className="option-letter">{option.label}.</span><span>{option.text}</span>
          {correct ? <Check aria-label="Correct option" /> : wrong ? <X aria-label="Your incorrect answer" /> : selected ? <Check aria-hidden="true" /> : <span />}
        </Button>;
      })}
    </fieldset>
    {!ended && <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" name="mark" value="toggle" variant="ghost" disabled={pending}><Flag />{response.marked ? "Unmark for review" : "Mark for review"}</Button>
      {response.option && <Button type="submit" name="option" value="" variant="ghost" disabled={pending}>Clear selection</Button>}
      <span aria-live="polite" className="text-sm text-muted-foreground">{pending ? "Saving…" : response.option ? "Answer saved" : ""}</span>
    </div>}
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
  </form>;
}

export function DeleteReview({ id }: { id: string }) {
  return <form action={deleteTestReview.bind(null, id)} onSubmit={(event) => {
    if (!window.confirm("Delete this test review? Individual attempts will stay in Progress.")) event.preventDefault();
  }}>
    <Button type="submit" variant="ghost" size="sm"><Trash2 />Delete review</Button>
  </form>;
}
