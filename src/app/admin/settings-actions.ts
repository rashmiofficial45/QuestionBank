"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/database";
import { editorialSettings } from "@/database/schema";
import { taxonomySchema, testDefaultsSchema, updateTaxonomy } from "@/modules/editorial-settings";
import { requireAdmin } from "@/modules/imports";

type Status = { message?: string; error?: string };

export async function saveTestDefaults(_status: Status, form: FormData): Promise<Status> {
  await requireAdmin();
  const result = testDefaultsSchema.safeParse({ minutes: Number(form.get("minutes")), marks: Number(form.get("marks")), penalty: form.get("penalty") });
  if (!result.success) return { error: "Check the duration, marks, and penalty." };
  await db.insert(editorialSettings).values({ key: "test-defaults", value: result.data })
    .onConflictDoUpdate({ target: editorialSettings.key, set: { value: result.data } });
  revalidatePath("/practice");
  return { message: "Test defaults saved." };
}

export async function saveTaxonomy(_status: Status, form: FormData): Promise<Status> {
  await requireAdmin();
  const id = form.get("id");
  const result = taxonomySchema.safeParse({ id: id || crypto.randomUUID(), name: form.get("name"), kind: form.get("kind"), parent: form.get("parent") || null });
  if (!result.success) return { error: "Check the classification name and parent." };
  const entry = result.data;
  const saved = await updateTaxonomy((entries) => {
    const prior = entries.find((item) => item.id === entry.id);
    if (id && (!prior || prior.kind !== entry.kind || prior.parent !== entry.parent)) return null;
    const parentKind = entry.kind === "topic" ? "subject" : entry.kind === "subtopic" ? "topic" : null;
    if (parentKind ? !entries.some((item) => item.id === entry.parent && item.kind === parentKind) : entry.parent !== null) return null;
    if (entry.kind === "tag" && entry.name.length > 40) return null;
    if (entries.some((item) => item.id !== entry.id && item.kind === entry.kind && item.parent === entry.parent && item.name.toLowerCase() === entry.name.toLowerCase())) return null;
    return prior ? entries.map((item) => item.id === entry.id ? entry : item) : [...entries, entry];
  });
  if (!saved) return { error: "Use a unique name and the correct parent classification." };
  revalidatePath("/admin/settings");
  return { message: "Classification saved." };
}

export async function removeTaxonomy(id: string, _status: Status): Promise<Status> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { error: "Classification unavailable." };
  const saved = await updateTaxonomy((entries) => entries.some((item) => item.parent === id) ? null : entries.filter((item) => item.id !== id));
  if (!saved) return { error: "Remove the child classifications first." };
  revalidatePath("/admin/settings");
  return { message: "Classification removed from suggestions." };
}
