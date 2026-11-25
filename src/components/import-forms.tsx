"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileUp, Plus, Save, Trash2 } from "lucide-react";
import { saveDraft, uploadPapers } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import type { Content } from "@/lib/content";
import { choiceIds } from "@/lib/choice-selection";

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadPapers, {});
  return <form className="upload-form" action={action}>
    <div className="field-grid">
      <label className="field">Paper title <Input name="title" required maxLength={120} placeholder="Polity PT-01" /></label>
      <label className="field">Subject <Input name="subject" required maxLength={60} placeholder="Polity" /></label>
    </div>
    <label className="field">Question paper PDF <Input type="file" name="paper" accept=".pdf,application/pdf" required /></label>
    <label className="field">Answer key PDF <Input type="file" name="key" accept=".pdf,application/pdf" required /></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <div><Button type="submit" disabled={pending}><FileUp size={17} />{pending ? "Uploading…" : "Upload and process"}</Button></div>
  </form>;
}

type Classification = { subject: string; topic: string; difficulty: string; tags: string[] };

export function EditForm({ content, importId, id, issues, generation, classification }: {
  content: Content; importId: string; id: string; issues: string[]; generation: number; classification: Classification;
}) {
  const [state, action, pending] = useActionState(saveDraft.bind(null, importId, id, generation), {});
  const [blocks, setBlocks] = useState(content.blocks);
  const lockSourceText = blocks.some((block) => block.type === "source_crop" && !block.reference);
  const [options, setOptions] = useState(() => content.options.map((option, index) => ({
    ...option,
    id: content.options.findIndex((item) => item.id === option.id) === index ? option.id : `source-duplicate-${index}`,
  })));
  const [taxonomy, setTaxonomy] = useState({ ...classification, tags: classification.tags.join(", ") });
  const [interaction, setInteraction] = useState(content.interaction);
  const [answers, setAnswers] = useState(() => choiceIds(content.answer));
  const [explanation, setExplanation] = useState(content.explanation);
  const [verified, setVerified] = useState(false);
  function move(index: number, offset: -1 | 1) {
    setOptions((items) => {
      const next = [...items];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }

  return <form className="upload-form" action={action}>
    {blocks.map((block, index) => {
      if (block.type === "paragraph") return <label className="field" key={block.id}>
        {index ? "Text after table" : "Question text"}
        <Textarea name={`stem-${block.id}`} value={block.text} onChange={(event) => {
          const text = event.target.value;
          setBlocks((current) => current.map((item) => item.id === block.id ? { ...block, text } : item));
        }} rows={index ? 3 : 5} required readOnly={lockSourceText} />
      </label>;
      if (block.type !== "table") return null;
      const cellInput = (value: string, row: "header" | number, col: number) => <Input
        aria-label={row === "header" ? `Table header ${col + 1}` : `Table row ${row + 1}, column ${col + 1}`}
        name={`cell-${block.id}-${row}-${col}`} value={value} maxLength={2000} readOnly={lockSourceText}
        onChange={(event) => {
          const text = event.target.value;
          setBlocks((current) => current.map((item) => {
            if (item.type !== "table" || item.id !== block.id) return item;
            if (row === "header") return { ...item, headers: item.headers.map((cell, position) => position === col ? text : cell) };
            return { ...item, rows: item.rows.map((cells, position) => position === row ? cells.map((cell, column) => column === col ? text : cell) : cells) };
          }));
        }} />;
      return <div className="min-w-0 rounded-md border" key={block.id}><Table aria-label="Edit question table">
        <TableHeader><TableRow>{block.headers.map((header, col) => <TableHead key={col}>{cellInput(header, "header", col)}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{block.rows.map((cells, row) => <TableRow key={row}>{cells.map((value, col) => <TableCell key={col}>{cellInput(value, row, col)}</TableCell>)}</TableRow>)}</TableBody>
      </Table></div>;
    })}
    <label className="field">Answer interaction
      <select name="interaction" aria-label="Answer interaction" value={interaction} onChange={(event) => {
        const next = event.target.value === "multiple_choice" ? "multiple_choice" : "single_choice";
        setInteraction(next);
        if (next === "single_choice") setAnswers((current) => current.slice(0, 1));
      }}><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple correct answers</option></select>
    </label>
    <input type="hidden" name="options" value={JSON.stringify(options)} />
    <section className="grid gap-3">
      <h3 className="font-semibold">Answer options</h3>
      {options.map(({ id, label, text }, index) => <div className="editor-option" key={id}>
        <label className="field">Label <Input aria-label={`Label for option ${index + 1}`} value={label} maxLength={12} required onChange={(event) => setOptions((current) => current.map((item) => item.id === id ? { ...item, label: event.target.value } : item))} /></label>
        <label className="field">Option {label}<Textarea value={text} onChange={(event) => setOptions((current) => current.map((option) => option.id === id ? { ...option, text: event.target.value } : option))} rows={2} required maxLength={8000} /></label>
        <div className="editor-option-actions">
          <Button variant="outline" type="button" size="icon-sm" aria-label={`Move option ${label} up`} disabled={!index} onClick={() => move(index, -1)}><ArrowUp /></Button>
          <Button variant="outline" type="button" size="icon-sm" aria-label={`Move option ${label} down`} disabled={index === options.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
          <Button variant="ghost" type="button" size="icon-sm" aria-label={`Remove option ${label}`} onClick={() => {
            setOptions((current) => current.filter((option) => option.id !== id));
            setAnswers((current) => current.filter((answer) => answer !== id));
          }}><Trash2 /></Button>
        </div>
      </div>)}
      <Button type="button" variant="outline" className="justify-self-start" disabled={options.length >= 12} onClick={() => {
        const label = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").find((letter) => !options.some((option) => option.label.toUpperCase() === letter)) ?? "";
        setOptions([...options, { id: crypto.randomUUID(), label, text: "" }]);
      }}><Plus />Add option</Button>
    </section>
    {interaction === "multiple_choice"
      ? <fieldset className="grid gap-2"><legend className="mb-2 font-medium">Correct answers</legend>
          {options.map((option) => <label className="flex items-center gap-2" key={option.id}>
            <input type="checkbox" name="answer" value={option.id} checked={answers.includes(option.id)}
              onChange={(event) => setAnswers(event.target.checked ? [...answers, option.id] : answers.filter((id) => id !== option.id))} />
            Option {option.label}
          </label>)}
        </fieldset>
      : <label className="field">Correct answer<select name="answer" aria-label="Correct answer" value={answers[0] ?? ""} onChange={(event) => setAnswers(event.target.value ? [event.target.value] : [])}><option value="">Choose an answer</option>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>}
    <label className="field">Explanation<Textarea name="explanation" value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={3} maxLength={8000} /></label>
    <section className="grid gap-3">
      <h3 className="font-semibold">Classification</h3>
      <div className="field-grid">
        <label className="field">Subject<Input name="subject" value={taxonomy.subject} onChange={(event) => setTaxonomy({ ...taxonomy, subject: event.target.value })} required maxLength={60} /></label>
        <label className="field">Topic<Input name="topic" value={taxonomy.topic} onChange={(event) => setTaxonomy({ ...taxonomy, topic: event.target.value })} required maxLength={80} /></label>
      </div>
      <label className="field">Difficulty<select name="difficulty" value={taxonomy.difficulty} onChange={(event) => setTaxonomy({ ...taxonomy, difficulty: event.target.value })}>
        {["Unrated", "Easy", "Medium", "Hard"].map((level) => <option key={level}>{level}</option>)}
      </select></label>
      <label className="field">Tags<Input name="tags" value={taxonomy.tags} onChange={(event) => setTaxonomy({ ...taxonomy, tags: event.target.value })} placeholder="Comma-separated tags" maxLength={510} /></label>
    </section>
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
