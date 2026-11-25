"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Save } from "lucide-react";
import { saveDraft, uploadPapers } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import type { Content } from "@/lib/content";

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadPapers, {});
  return <form className="upload-form" action={action}>
    <div className="field-grid">
      <label className="field">Paper title <input name="title" required maxLength={120} placeholder="Polity PT-01" /></label>
      <label className="field">Subject <input name="subject" required maxLength={60} placeholder="Polity" /></label>
    </div>
    <label className="field">Question paper PDF <input type="file" name="paper" accept=".pdf,application/pdf" required /></label>
    <label className="field">Answer key PDF <input type="file" name="key" accept=".pdf,application/pdf" required /></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <div><Button type="submit" disabled={pending}><FileUp size={17} />{pending ? "Uploading…" : "Upload and process"}</Button></div>
  </form>;
}

export function EditForm({ content, importId, id, issues }: { content: Content; importId: string; id: string; issues: string[] }) {
  const [state, action, pending] = useActionState(saveDraft.bind(null, importId, id), {});
  const original = content.blocks.flatMap((block) => block.type === "paragraph" ? [block.text] : []).join("\n");
  const [stem, setStem] = useState(original);
  const [options, setOptions] = useState(content.options);
  const [answer, setAnswer] = useState(content.answer ?? "");
  const [explanation, setExplanation] = useState(content.explanation);
  const [verified, setVerified] = useState(false);
  return <form className="upload-form" action={action}>
    <label className="field">Question text<textarea name="stem" value={stem} onChange={(event) => setStem(event.target.value)} rows={7} required readOnly={content.blocks.some((block) => block.type === "source_crop")} /></label>
    {options.map(({ id, label, text }) => <label className="field" key={id}>Option {label}<textarea name={`option-${id}`} value={text} onChange={(event) => setOptions((current) => current.map((option) => option.id === id ? { ...option, text: event.target.value } : option))} rows={2} required maxLength={8000} /></label>)}
    <label className="field">Correct answer<select name="answer" value={answer} onChange={(event) => setAnswer(event.target.value)}><option value="">Choose an answer</option>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
    <label className="field">Explanation<textarea name="explanation" value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={3} maxLength={8000} /></label>
    {issues.length > 0 && <label><input type="checkbox" name="verified" checked={verified} onChange={(event) => setVerified(event.target.checked)} /> I verified this draft against the source documents.</label>}
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    {state.saved && <p role="status" className="notice">Draft saved.</p>}
    <div><Button type="submit" disabled={pending}><Save size={16} />{pending ? "Saving…" : "Save draft"}</Button></div>
  </form>;
}

export function RefreshImport() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 2200);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
