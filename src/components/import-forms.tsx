"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FileUp, Plus, Save, Trash2, X } from "lucide-react";
import { saveDraft, uploadPapers } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { presentations, textStyles, type Content } from "@/lib/content";
import { choiceIds } from "@/lib/choice-selection";
import { isWritten, writtenFormats } from "@/lib/written-answer";
import { isRanked, rankedFormats } from "@/lib/ranked-answer";
import type { TaxonomyEntry } from "@/modules/editorial-settings";
import { useDraftBuffer } from "@/components/use-draft-buffer";
import { QuestionContent } from "@/components/question-content";
import { OptionContent } from "@/components/option-content";

function PdfFileField({ name, label, required, hint, disabled }: {
  name: string; label: string; required?: boolean; hint?: string; disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(false);
  const id = `upload-${name}`;

  useEffect(() => {
    const form = ref.current?.form;
    const reset = () => setSelected(false);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);

  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <div className="pdf-file-control" data-selected={selected || undefined}>
      <Input ref={ref} id={id} type="file" name={name} accept=".pdf,application/pdf" required={required} disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined} onChange={(event) => setSelected(Boolean(event.currentTarget.files?.length))} />
      {selected && <Button className="pdf-file-clear" type="button" variant="outline" size="icon-sm"
        aria-label={`Remove ${label.replace(" (optional)", "")}`} disabled={disabled} onClick={() => {
          const input = ref.current;
          if (!input) return;
          input.value = "";
          setSelected(false);
          input.focus();
        }}><X /></Button>}
    </div>
    {hint && <p id={`${id}-hint`} className="text-sm font-normal text-muted-foreground">{hint}</p>}
  </div>;
}

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadPapers, {});
  return <form className="upload-form" action={action}>
    <div className="field-grid">
      <label className="field">Paper title <Input name="title" required maxLength={120} placeholder="Polity PT-01" /></label>
      <label className="field">Subject <Input name="subject" required maxLength={60} placeholder="Polity" /></label>
    </div>
    <PdfFileField name="paper" label="Question paper PDF" required disabled={pending} />
    <PdfFileField name="key" label="Answer key only PDF (optional)" disabled={pending}
      hint="Attach a separate key only if you want to cross-check the answers." />
    <PdfFileField name="detailed" label="Answer key with detailed explanations PDF" required disabled={pending}
      hint="Upload one PDF with the answer key first and the numbered explanations after it." />
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <div><Button type="submit" disabled={pending}><FileUp size={17} />{pending ? "Uploading…" : "Upload and process"}</Button></div>
  </form>;
}

type Classification = { subject: string; topic: string; difficulty: string; tags: string[] };

type DraftBlock = Content["blocks"][number];

async function imageData(file: File | undefined) {
  if (!file || !["image/png", "image/jpeg"].includes(file.type) || file.size > 1_000_000) {
    throw new Error("Choose a PNG or JPEG under 1 MB.");
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

export function EditForm({ content, importId, id, issues, generation, classification, catalog }: {
  content: Content; importId: string; id: string; issues: string[]; generation: number; classification: Classification; catalog: TaxonomyEntry[];
}) {
  const [state, action, pending] = useActionState(saveDraft.bind(null, importId, id, generation), {});
  const initial = useMemo(() => ({
    blocks: content.blocks,
    options: content.options.map((option, index) => ({
      ...option,
      id: content.options.findIndex((item) => item.id === option.id) === index ? option.id : `source-duplicate-${index}`,
    })),
    taxonomy: { ...classification, tags: classification.tags.join(", ") },
    interaction: content.interaction, presentation: content.presentation ?? "",
    referenceAnswer: isWritten(content.interaction) && typeof content.answer === "string" ? content.answer : "",
    sequence: isRanked(content.interaction) ? choiceIds(content.answer).map((id) =>
      content.options.find((option) => option.id === id)?.label ?? "").join(", ") : "",
    prompts: content.interaction === "pair_matching" ? content.prompts.join("\n") : "",
    answers: choiceIds(content.answer), explanation: content.explanation,
  }), [content, classification]);
  const buffer = useDraftBuffer(`atlas-editor-draft:${id}:${generation}`, initial);
  const { blocks, options, taxonomy, interaction, presentation, referenceAnswer, sequence, prompts, answers, explanation } = buffer.current;
  const setBlocks = (value: DraftBlock[] | ((current: DraftBlock[]) => DraftBlock[])) => buffer.field("blocks", value);
  const setOptions = (value: Content["options"] | ((current: Content["options"]) => Content["options"])) => buffer.field("options", value);
  const setAnswers = (value: string[] | ((current: string[]) => string[])) => buffer.field("answers", value);
  const written = isWritten(interaction);
  const ranked = isRanked(interaction);
  const [verified, setVerified] = useState(false);
  const [imageError, setImageError] = useState("");
  const [autosave, setAutosave] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const autoButton = useRef<HTMLButtonElement>(null);
  const lastAutoSave = useRef("");
  useEffect(() => {
    if (!autosave || pending || buffer.current === initial) return;
    const snapshot = JSON.stringify(buffer.current);
    if (snapshot === JSON.stringify(initial) || lastAutoSave.current === snapshot) return;
    const timer = setTimeout(() => {
      if (formRef.current?.checkValidity() && autoButton.current) {
        lastAutoSave.current = snapshot;
        formRef.current.requestSubmit(autoButton.current);
      }
    }, 1600);
    return () => clearTimeout(timer);
  }, [autosave, buffer.current, initial, pending]);
  async function addImage(file: File | undefined, optionId?: string) {
    try {
      const block = { id: crypto.randomUUID(), type: "image" as const, data: await imageData(file), alt: "" };
      if (optionId) setOptions((current) => current.map((option) => option.id === optionId ? { ...option, blocks: [...option.blocks ?? [], block] } : option));
      else setBlocks((current) => [...current, block]);
      setImageError("");
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "The image could not be read.");
    }
  }
  function changeBlock(id: string, update: (block: DraftBlock) => DraftBlock) {
    setBlocks((current) => current.map((block) => block.id === id ? update(block) : block));
  }
  function moveBlock(index: number, offset: number) {
    setBlocks((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }
  function move(index: number, offset: -1 | 1) {
    setOptions((items) => {
      const next = [...items];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  }

  const renderedBlocks = blocks.map((block, index) => {
      if (block.type === "paragraph") return <div className="grid gap-2" key={block.id}>
        <label className="field">{index === 0 ? "Question text" : "Additional question text"}
          <Textarea name={`stem-${block.id}`} value={block.text} onChange={(event) => {
          const text = event.target.value;
          setBlocks((current) => current.map((item) => item.id === block.id ? { ...block, text } : item));
          }} rows={index ? 3 : 5} required />
        </label>
        <label className="field">Text block style
          <select name={`style-${block.id}`} value={block.style ?? "paragraph"}
            onChange={(event) => changeBlock(block.id, (current) => ({ ...current, style: event.target.value as typeof textStyles[number] }))}>
            <option value="paragraph">Paragraph</option>
            {textStyles.slice(1).map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </div>;
      if (block.type === "assertion_reason") return <fieldset key={block.id} className="grid gap-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Assertion and reason</legend>
        {(["assertion", "reason"] as const).map((part) => <label key={part} className="field">
          {block[part].label}
          <Textarea name={`${part}-${block.id}`} aria-label={block[part].label} value={block[part].text}
            rows={2} required onChange={(event) => {
              const text = event.target.value;
              setBlocks((current) => current.map((entry) => entry.type === "assertion_reason" && entry.id === block.id
                ? { ...entry, [part]: { ...entry[part], text } }
                : entry));
            }} />
        </label>)}
      </fieldset>;
      if (block.type === "statements") return <fieldset className="grid gap-3 rounded-md border p-3" key={block.id}>
        <legend className="px-1 text-sm font-medium">Statements</legend>
        {block.items.map((item, position) => <label className="field" key={position}>
          {item.label}
          <Textarea name={`statement-${block.id}-${position}`} aria-label={item.label} value={item.text} rows={2} required
            onChange={(event) => {
              const text = event.target.value;
              setBlocks((current) => current.map((entry) => entry.type === "statements" && entry.id === block.id
                ? { ...entry, items: entry.items.map((statement, index) => index === position ? { ...statement, text } : statement) }
                : entry));
            }} />
        </label>)}
      </fieldset>;
      if (block.type === "source_crop" || block.type === "image") return <div className="grid gap-2">
        <label className="field">Image description<Input value={block.alt} required maxLength={500}
          onChange={(event) => changeBlock(block.id, (entry) => ({ ...entry, alt: event.target.value }))} /></label>
        {block.type === "source_crop" && <label className="flex gap-2"><input type="checkbox" checked={Boolean(block.reference)}
          onChange={(event) => changeBlock(block.id, (entry) => ({ ...entry, reference: event.target.checked }))} />Show PDF crop as a reference</label>}
        <QuestionContent blocks={[block]} importId={importId} administrative />
      </div>;
      if (block.type !== "table") return null;
      const cellInput = (value: string, row: "header" | number, col: number) => <Input
        aria-label={row === "header" ? `Table header ${col + 1}` : `Table row ${row + 1}, column ${col + 1}`}
        name={`cell-${block.id}-${row}-${col}`} value={value} maxLength={2000}
        onChange={(event) => {
          const text = event.target.value;
          setBlocks((current) => current.map((item) => {
            if (item.type !== "table" || item.id !== block.id) return item;
            if (row === "header") return { ...item, headers: item.headers.map((cell, position) => position === col ? text : cell) };
            return { ...item, rows: item.rows.map((cells, position) => position === row ? cells.map((cell, column) => column === col ? text : cell) : cells) };
          }));
        }} />;
      return <div className="grid gap-2">
        <div className="min-w-0 rounded-md border"><Table aria-label="Edit question table">
          <TableHeader><TableRow>{block.headers.map((header, col) => <TableHead key={col}>{cellInput(header, "header", col)}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{block.rows.map((cells, row) => <TableRow key={row}>{cells.map((value, col) => <TableCell key={col}>{cellInput(value, row, col)}</TableCell>)}</TableRow>)}</TableBody>
        </Table></div>
        <label className="field">Merged cells (row, column, row span, column span)
          <Textarea key={JSON.stringify(block.spans)} defaultValue={block.spans?.map(({ row, column, rowSpan, colSpan }) => [row + 1, column + 1, rowSpan, colSpan].join(", ")).join("\n")}
            onBlur={(event) => {
              const values = event.target.value.trim();
              const spans = values ? values.split("\n").map((line) => {
                const [row, column, rowSpan, colSpan] = line.split(",").map(Number);
                return { row: row - 1, column: column - 1, rowSpan, colSpan };
              }) : undefined;
              if (JSON.stringify(spans) !== JSON.stringify(block.spans)) changeBlock(block.id, (entry) => ({ ...entry, spans }));
            }} />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={block.rows.length >= 39}
            onClick={() => changeBlock(block.id, (entry) => entry.type === "table" ? { ...entry, rows: [...entry.rows, entry.headers.map(() => "")] } : entry)}>Add row</Button>
          <Button type="button" size="sm" variant="outline" disabled={block.headers.length >= 12}
            onClick={() => changeBlock(block.id, (entry) => entry.type === "table" ? { ...entry, headers: [...entry.headers, ""], rows: entry.rows.map((row) => [...row, ""]) } : entry)}>Add column</Button>
          <Button type="button" size="sm" variant="outline" disabled={block.rows.length <= 1 || Boolean(block.spans?.length)}
            onClick={() => changeBlock(block.id, (entry) => entry.type === "table" ? { ...entry, rows: entry.rows.slice(0, -1) } : entry)}>Remove last row</Button>
          <Button type="button" size="sm" variant="outline" disabled={block.headers.length <= 2 || Boolean(block.spans?.length)}
            onClick={() => changeBlock(block.id, (entry) => entry.type === "table" ? { ...entry, headers: entry.headers.slice(0, -1), rows: entry.rows.map((row) => row.slice(0, -1)) } : entry)}>Remove last column</Button>
        </div>
      </div>;
  });

  return <form className="upload-form" action={action} ref={formRef}>
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={buffer.undo} disabled={!buffer.canUndo}>Undo</Button>
      <Button type="button" variant="outline" size="sm" onClick={buffer.redo} disabled={!buffer.canRedo}>Redo</Button>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autosave} onChange={(event) => setAutosave(event.target.checked)} />Autosave valid drafts</label>
      <span className="text-xs text-muted-foreground">Unsaved edits are backed up in this browser.</span>
    </div>
    <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
    {renderedBlocks.map((block, index) => <div key={blocks[index].id} className="grid min-w-0 gap-2">
      {block}
      <div className="flex flex-wrap gap-1">
        <Button type="button" variant="ghost" size="sm" disabled={!index} onClick={() => moveBlock(index, -1)}>Move block up</Button>
        <Button type="button" variant="ghost" size="sm" disabled={index + 1 === blocks.length} onClick={() => moveBlock(index, 1)}>Move block down</Button>
        <Button type="button" variant="ghost" size="sm" disabled={blocks.length <= 1} onClick={() => setBlocks((current) => current.filter((_, position) => index !== position))}>Remove block</Button>
      </div>
    </div>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setBlocks([...blocks, { id: crypto.randomUUID(), type: "paragraph", text: "" }])}>Add text block</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setBlocks([...blocks, { id: crypto.randomUUID(), type: "table", page: 1, bounds: [0, 0, 1, 1], headers: ["", ""], rows: [["", ""]] }])}>Add table</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setBlocks([...blocks, { id: crypto.randomUUID(), type: "statements",
        items: [{ label: "1.", text: "" }, { label: "2.", text: "" }] }])}>Add statements</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setBlocks([...blocks, { id: crypto.randomUUID(), type: "assertion_reason",
        assertion: { label: "Assertion (A)", text: "" }, reason: { label: "Reason (R)", text: "" } }])}>Add Assertion–Reason</Button>
    </div>
    <label className="field">Add question image<Input type="file" accept="image/png,image/jpeg" onChange={(event) => { void addImage(event.target.files?.[0]); }} /></label>
    {imageError && <p className="form-error" role="alert">{imageError}</p>}
    <label className="field">Question layout
      <select name="presentation" aria-label="Question layout" value={presentation} onChange={(event) => buffer.field("presentation", event.target.value as typeof presentation)}>
        <option value="">Standard</option>
        {Object.entries(presentations).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    <label className="field">Answer interaction
      <select name="interaction" aria-label="Answer interaction" value={interaction} onChange={(event) => {
        const value = event.target.value;
        const next = isWritten(value) || isRanked(value) || value === "multiple_choice" || value === "true_false" ? value : "single_choice";
        buffer.field("interaction", next);
        if (next !== "multiple_choice") setAnswers((current) => current.slice(0, 1));
      }}><option value="single_choice">Single choice</option><option value="true_false">True/False</option><option value="multiple_choice">Multiple correct answers</option>
        {Object.entries({ ...writtenFormats, ...rankedFormats }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    <input type="hidden" name="options" value={JSON.stringify(options)} />
    {!written && <section className="grid gap-3">
      <h3 className="font-semibold">Answer options</h3>
      {options.map((option, index) => {
        const { id, label, text } = option;
        const equation = option.blocks?.some((block) => block.type === "paragraph") ?? false;
        const crops = option.blocks?.filter((block) => block.type === "source_crop" || block.type === "image") ?? [];
        function updateOption(value: string, math: boolean) {
          const blocks: NonNullable<typeof option.blocks> = [...crops];
          if (math) blocks.unshift({ id: "option-equation", type: "paragraph", style: "equation", text: value });
          setOptions((current) => current.map((item) => item.id === id ? { ...item, text: value, blocks: blocks.length ? blocks : undefined } : item));
        }
        return <div className="editor-option" key={id}>
          <label className="field">Label <Input aria-label={`Label for option ${index + 1}`} value={label} maxLength={12} required onChange={(event) => setOptions((current) => current.map((item) => item.id === id ? { ...item, label: event.target.value } : item))} /></label>
          <div className="grid min-w-0 gap-2">
            <label className="field">Option {label}<Textarea value={text} onChange={(event) => updateOption(event.target.value, equation)} rows={2} required maxLength={8000} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={equation} onChange={(event) => updateOption(text, event.target.checked)} />Render option {label} as LaTeX</label>
            <label className="field">Add image to option {label}<Input type="file" accept="image/png,image/jpeg"
              disabled={(option.blocks?.length ?? 0) >= 5} onChange={(event) => { void addImage(event.target.files?.[0], id); }} /></label>
            {crops.map((image) => <div className="grid gap-2" key={image.id}>
              <label className="field">Image description<Input value={image.alt} required maxLength={500} onChange={(event) => {
                const alt = event.target.value;
                setOptions((current) => current.map((item) => item.id === id ? { ...item, blocks: item.blocks?.map((block) => block.id === image.id ? { ...block, alt } : block) } : item));
              }} /></label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOptions((current) => current.map((item) => {
                if (item.id !== id) return item;
                const blocks = item.blocks?.filter((block) => block.id !== image.id);
                return { ...item, blocks: blocks?.length ? blocks : undefined };
              }))}>Remove option image</Button>
            </div>)}
            {(crops.length > 0 || (equation && text.trim())) && <OptionContent option={option} importId={importId} administrative />}
          </div>
          <div className="editor-option-actions">
            <Button variant="outline" type="button" size="icon-sm" aria-label={`Move option ${label} up`} disabled={!index} onClick={() => move(index, -1)}><ArrowUp /></Button>
            <Button variant="outline" type="button" size="icon-sm" aria-label={`Move option ${label} down`} disabled={index === options.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
            <Button variant="ghost" type="button" size="icon-sm" aria-label={`Remove option ${label}`} onClick={() => {
              setOptions((current) => current.filter((option) => option.id !== id));
              setAnswers((current) => current.filter((answer) => answer !== id));
            }}><Trash2 /></Button>
          </div>
          </div>;
      })}
      <Button type="button" variant="outline" className="justify-self-start" disabled={options.length >= 12} onClick={() => {
        const label = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").find((letter) => !options.some((option) => option.label.toUpperCase() === letter)) ?? "";
        setOptions([...options, { id: crypto.randomUUID(), label, text: "" }]);
      }}><Plus />Add option</Button>
    </section>}
    {ranked ? <div className="grid gap-3">
      {interaction === "pair_matching" && <label className="field">Matching prompts (one per line)
        <Textarea name="prompts" aria-label="Matching prompts" value={prompts} onChange={(event) => buffer.field("prompts", event.target.value)} rows={4} />
      </label>}
      <label className="field">Correct sequence of option labels
        <Input name="sequence" aria-label="Correct sequence of option labels" placeholder="B, A, C" value={sequence} onChange={(event) => buffer.field("sequence", event.target.value)} />
      </label>
    </div> : written ? <label className="field">Reference answer
      <Textarea name="written-answer" aria-label="Reference answer" value={referenceAnswer} rows={3} maxLength={8000}
        onChange={(event) => buffer.field("referenceAnswer", event.target.value)} />
    </label> : interaction === "multiple_choice"
      ? <fieldset className="grid gap-2"><legend className="mb-2 font-medium">Correct answers</legend>
          {options.map((option) => <label className="flex items-center gap-2" key={option.id}>
            <input type="checkbox" name="answer" value={option.id} checked={answers.includes(option.id)}
              onChange={(event) => setAnswers(event.target.checked ? [...answers, option.id] : answers.filter((id) => id !== option.id))} />
            Option {option.label}
          </label>)}
        </fieldset>
      : <label className="field">Correct answer<select name="answer" aria-label="Correct answer" value={answers[0] ?? ""} onChange={(event) => setAnswers(event.target.value ? [event.target.value] : [])}><option value="">Choose an answer</option>{options.map((option) => <option value={option.id} key={option.id}>{interaction === "true_false" ? option.text : option.label}</option>)}</select></label>}
    <label className="field">Explanation<Textarea name="explanation" value={explanation} onChange={(event) => buffer.field("explanation", event.target.value)} rows={3} maxLength={8000} /></label>
    <section className="grid gap-3">
      <h3 className="font-semibold">Classification</h3>
      <div className="field-grid">
        <label className="field">Subject<Input name="subject" list="draft-subjects" value={taxonomy.subject} onChange={(event) => buffer.field("taxonomy", { ...taxonomy, subject: event.target.value })} required maxLength={60} /></label>
        <label className="field">Topic<Input name="topic" list="draft-topics" value={taxonomy.topic} onChange={(event) => buffer.field("taxonomy", { ...taxonomy, topic: event.target.value })} required maxLength={80} /></label>
      </div>
      <label className="field">Difficulty<select name="difficulty" value={taxonomy.difficulty} onChange={(event) => buffer.field("taxonomy", { ...taxonomy, difficulty: event.target.value })}>
        {["Unrated", "Easy", "Medium", "Hard"].map((level) => <option key={level}>{level}</option>)}
      </select></label>
      <label className="field">Tags<Input name="tags" list="draft-tags" value={taxonomy.tags} onChange={(event) => buffer.field("taxonomy", { ...taxonomy, tags: event.target.value })} placeholder="Comma-separated tags" maxLength={510} /></label>
    </section>
    <datalist id="draft-subjects">{catalog.filter(({ kind }) => kind === "subject").map(({ id, name }) => <option key={id} value={name} />)}</datalist>
    <datalist id="draft-topics">{catalog.flatMap((entry) => {
      if (entry.kind !== "topic" && entry.kind !== "subtopic") return [];
      const parent = catalog.find(({ id }) => id === entry.parent);
      const subject = entry.kind === "topic" ? parent : catalog.find(({ id }) => id === parent?.parent);
      const name = entry.kind === "topic" ? entry.name : `${parent?.name} / ${entry.name}`;
      return subject?.name === taxonomy.subject && name.length <= 80 ? [<option key={entry.id} value={name} />] : [];
    })}</datalist>
    <datalist id="draft-tags">{catalog.filter(({ kind }) => kind === "tag").map(({ id, name }) => <option key={id} value={name} />)}</datalist>
    {issues.length > 0 && <label><input type="checkbox" name="verified" checked={verified} onChange={(event) => setVerified(event.target.checked)} /> I verified this draft against the source documents.</label>}
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    {state.saved && <p role="status" className="notice">Draft saved.</p>}
    <div><Button type="submit" disabled={pending}><Save size={16} />{pending ? "Saving…" : "Save draft"}</Button></div>
    <button ref={autoButton} name="save-mode" value="automatic" type="submit" hidden tabIndex={-1} />
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
