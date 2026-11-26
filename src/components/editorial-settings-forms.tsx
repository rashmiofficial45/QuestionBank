"use client";

import { useActionState, useState } from "react";
import { removeTaxonomy, saveTaxonomy, saveTestDefaults } from "@/app/admin/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { getTestDefaults, TaxonomyEntry } from "@/modules/editorial-settings";

function Feedback({ status }: { status: { error?: string; message?: string } }) {
  return status.error ? <p className="form-error" role="alert">{status.error}</p>
    : status.message ? <p className="text-sm" role="status">{status.message}</p> : null;
}

export function TestDefaultsForm({ settings }: { settings: Awaited<ReturnType<typeof getTestDefaults>> }) {
  const [state, action, pending] = useActionState(saveTestDefaults, {});
  return <form className="upload-form" action={action}>
    <div className="field-grid">
      <label className="field">Duration (minutes)<Input name="minutes" type="number" min={1} max={180} required defaultValue={settings.minutes} /></label>
      <label className="field">Marks per correct answer<Input name="marks" type="number" min={1} max={10} required defaultValue={settings.marks} /></label>
    </div>
    <label className="field">Wrong answer penalty<NativeSelect name="penalty" defaultValue={settings.penalty}>
      <NativeSelectOption value="third">One-third of the marks</NativeSelectOption>
      <NativeSelectOption value="none">No penalty</NativeSelectOption>
    </NativeSelect></label>
    <Feedback status={state} />
    <Button className="justify-self-start" disabled={pending}>Save test defaults</Button>
  </form>;
}

const kinds = { subject: "Subject", topic: "Topic", subtopic: "Subtopic", tag: "Tag" } as const;

export function TaxonomyForm({ entries }: { entries: TaxonomyEntry[] }) {
  const [kind, setKind] = useState<TaxonomyEntry["kind"]>("subject");
  const [state, action, pending] = useActionState(saveTaxonomy, {});
  const parentKind = kind === "topic" ? "subject" : kind === "subtopic" ? "topic" : null;
  return <form action={action} className="upload-form">
    <div className="field-grid">
      <label className="field">Classification type<NativeSelect name="kind" value={kind} onChange={(event) => setKind(event.target.value as TaxonomyEntry["kind"])}>
        {Object.entries(kinds).map(([key, label]) => <NativeSelectOption key={key} value={key}>{label}</NativeSelectOption>)}
      </NativeSelect></label>
      <label className="field">Name<Input name="name" required maxLength={kind === "tag" ? 40 : 60} /></label>
    </div>
    {parentKind && <label className="field">Parent {parentKind}<NativeSelect name="parent" key={parentKind} required>
      <NativeSelectOption value="">Choose a {parentKind}</NativeSelectOption>
      {entries.filter((entry) => entry.kind === parentKind).map((entry) => <NativeSelectOption key={entry.id} value={entry.id}>
        {[entries.find((item) => item.id === entry.parent)?.name, entry.name].filter(Boolean).join(" / ")}
      </NativeSelectOption>)}
    </NativeSelect></label>}
    <Feedback status={state} />
    <Button className="justify-self-start" disabled={pending}>Add classification</Button>
  </form>;
}

export function TaxonomyRow({ entry, parent }: { entry: TaxonomyEntry; parent?: string }) {
  const [saved, save, saving] = useActionState(saveTaxonomy, {});
  const [removed, remove, removing] = useActionState(removeTaxonomy.bind(null, entry.id), {});
  return <div className="grid gap-2 border-t py-3" role="group" aria-label={`${kinds[entry.kind]} ${entry.name}`}>
    <div className="flex flex-wrap items-end gap-2">
      <form action={save} className="flex min-w-0 flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={entry.id} /><input type="hidden" name="kind" value={entry.kind} />
        <input type="hidden" name="parent" value={entry.parent ?? ""} />
        <label className="field">{kinds[entry.kind]}{parent ? ` · ${parent}` : ""}<Input name="name" defaultValue={entry.name} required maxLength={60} /></label>
        <Button type="submit" variant="outline" disabled={saving}>Rename</Button>
      </form>
      <form action={remove}><Button type="submit" variant="ghost" disabled={removing}>Remove</Button></form>
    </div>
    <Feedback status={saved} /><Feedback status={removed} />
  </div>;
}
