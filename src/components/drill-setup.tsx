"use client";

import { useActionState } from "react";
import { startDrill } from "@/app/(student)/practice/drill/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function DrillSetup({ subjects, topics }: { subjects: string[]; topics: string[] }) {
  const [state, action, pending] = useActionState(startDrill, {});
  return <form action={action} className="upload-form">
    <div className="field-grid">
      <label className="field">Subject<NativeSelect name="subject"><NativeSelectOption value="">All subjects</NativeSelectOption>{subjects.map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect></label>
      <label className="field">Topic<NativeSelect name="topic"><NativeSelectOption value="">All topics</NativeSelectOption>{topics.map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect></label>
      <label className="field">Difficulty<NativeSelect name="difficulty"><NativeSelectOption value="">All difficulty levels</NativeSelectOption>{["Easy", "Medium", "Hard", "Unrated"].map((item) => <NativeSelectOption key={item}>{item}</NativeSelectOption>)}</NativeSelect></label>
      <label className="field">Questions<Input name="count" type="number" min={1} max={50} defaultValue={10} required /></label>
    </div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <Button className="justify-self-start" disabled={pending}>Start untimed practice</Button>
  </form>;
}
