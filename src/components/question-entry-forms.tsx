"use client";

import { useActionState } from "react";
import { createQuestion, uploadQuestionData } from "@/app/admin/question-entry-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function QuestionEntryForm({ manual }: { manual: boolean }) {
  const [state, action, pending] = useActionState(manual ? createQuestion : uploadQuestionData, {});
  return <form className="upload-form" action={action}>
    <div className="field-grid">
      <label className="field">Source title<Input name="title" required maxLength={120} /></label>
      <label className="field">Subject<Input name="subject" required maxLength={60} /></label>
    </div>
    {manual ? <label className="field">Question text<Textarea name="question" required maxLength={16000} rows={5} /></label>
      : <label className="field">CSV or JSON file<Input type="file" name="data" accept=".csv,.json,text/csv,application/json" required /></label>}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <div><Button type="submit" disabled={pending}>{pending ? "Staging…" : manual ? "Create draft" : "Import drafts"}</Button></div>
  </form>;
}
