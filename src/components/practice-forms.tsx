"use client";

import { startTransition, useActionState, useEffect, useOptimistic, useRef, useState } from "react";
import { Check, Flag, Timer, Trash2, X } from "lucide-react";
import { deleteTestReview, finishPractice, saveResponse, startPractice } from "@/app/(student)/practice/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Content } from "@/lib/content";
import type { TestResponse } from "@/database/schema";
import { choiceIds, type ChoiceSelection } from "@/lib/choice-selection";
import { isWritten } from "@/lib/written-answer";
import { Textarea } from "@/components/ui/textarea";
import { isRanked } from "@/lib/ranked-answer";
import { RankedFields, rankedLabels } from "@/components/ranked-fields";

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

export function TestOptions({ id, questionId, options, interaction, prompts, response, answer, ended }: {
  id: string; questionId: string; options: Content["options"]; interaction: Content["interaction"];
  response: TestResponse; answer?: ChoiceSelection | null; ended: boolean; prompts?: string[];
}) {
  const [state, action, pending] = useActionState(saveResponse.bind(null, id, questionId), {});
  const multiple = interaction === "multiple_choice";
  const prompt = interaction === "true_false" ? "Select True or False" : multiple ? "Select all correct answers" : "Select one answer";
  const [selectedIds, select] = useOptimistic(choiceIds(response.options ?? response.option), (_current, next: string[]) => next);
  const answerIds = choiceIds(answer);
  const written = isWritten(interaction);
  const ranked = isRanked(interaction);
  return <form action={action} noValidate={ranked} className="test-options">
    <fieldset disabled={ended || (pending && !multiple)} className="answer-form">
      <legend>{ended ? "Answer review" : written ? "Enter your response" : prompt}</legend>
      {written ? <>
        <Textarea key={response.option} aria-label="Your response" name="option" defaultValue={response.option ?? ""}
          rows={3} inputMode={interaction === "numeric" ? "decimal" : undefined} maxLength={8000} />
        {ended && typeof answer === "string" && <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Expected answer</strong> {answer}</p>}
        {!ended && <Button className="mt-2" type="submit" name="selection" value="written">Save response</Button>}
      </> : ranked ? <>
        <RankedFields key={response.options?.join(",")} options={options} prompts={prompts} selected={selectedIds} />
        {ended ? <p className="mt-3 whitespace-pre-wrap text-sm">{rankedLabels(options, answerIds, prompts)}</p>
          : <Button className="mt-2" type="submit">Save response</Button>}
      </> : options.map((option) => {
        const selected = selectedIds.includes(option.id);
        const correct = ended && answerIds.includes(option.id);
        const wrong = ended && selected && !correct;
        const style = correct ? "option-correct" : wrong ? "option-incorrect" : selected ? "option-selected" : "";
        const feedback = correct ? <Check aria-label="Correct option" /> : wrong ? <X aria-label="Your incorrect answer" /> : null;
        if (multiple) return <label key={option.id} className={`option option-checkbox test-choice ${style}`}>
          <input type="checkbox" name="option" value={option.id} checked={selected} data-test-answer
            onChange={(event) => {
              const next = event.target.checked ? [...selectedIds, option.id] : selectedIds.filter((value) => value !== option.id);
              const data = new FormData();
              data.set("selection", "multiple");
              next.forEach((value) => data.append("option", value));
              startTransition(() => { select(next); action(data); });
            }} />
          <span className="option-letter">{option.label}.</span><span>{option.text}</span>{feedback}
        </label>;
        return <Button key={option.id} type="submit" variant="outline" name="option" value={option.id} aria-pressed={selected} data-test-answer
          className={`option inline-option test-choice ${style}`}>
          <span className="option-letter">{option.label}.</span><span>{option.text}</span>
          {feedback ?? (selected ? <Check aria-hidden="true" /> : <span />)}
        </Button>;
      })}
    </fieldset>
    {!ended && <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" name="mark" value="toggle" variant="ghost" disabled={pending}><Flag />{response.marked ? "Unmark for review" : "Mark for review"}</Button>
      {selectedIds.length > 0 && <Button type="submit" name="selection" value="clear" variant="ghost" disabled={pending}>Clear selection</Button>}
      <span aria-live="polite" className="text-sm text-muted-foreground">{pending ? "Saving…" : selectedIds.length ? "Answer saved" : ""}</span>
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
