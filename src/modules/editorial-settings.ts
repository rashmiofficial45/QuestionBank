import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/database";
import { editorialSettings } from "@/database/schema";

export const testDefaultsSchema = z.object({
  minutes: z.number().int().min(1).max(180),
  marks: z.number().int().min(1).max(10),
  penalty: z.enum(["none", "third"]),
});
export const defaultTestSettings = { minutes: 60, marks: 2, penalty: "third" } as const;
export const taxonomySchema = z.object({
  id: z.uuid(),
  kind: z.enum(["subject", "topic", "subtopic", "tag"]),
  name: z.string().trim().min(1).max(60),
  parent: z.uuid().nullable(),
});
const catalogSchema = z.array(taxonomySchema).max(1000);
export type TaxonomyEntry = z.infer<typeof taxonomySchema>;

export async function getTestDefaults() {
  const [row] = await db.select().from(editorialSettings).where(eq(editorialSettings.key, "test-defaults"));
  return testDefaultsSchema.safeParse(row?.value).data ?? defaultTestSettings;
}

export async function getTaxonomy() {
  const [row] = await db.select().from(editorialSettings).where(eq(editorialSettings.key, "taxonomy"));
  return catalogSchema.safeParse(row?.value).data ?? [];
}

export async function updateTaxonomy(edit: (entries: TaxonomyEntry[]) => TaxonomyEntry[] | null) {
  return db.transaction(async (tx) => {
    await tx.insert(editorialSettings).values({ key: "taxonomy", value: [] }).onConflictDoNothing();
    const [row] = await tx.select().from(editorialSettings).where(eq(editorialSettings.key, "taxonomy")).for("update");
    const existing = catalogSchema.parse(row.value);
    const next = edit(existing);
    const validated = catalogSchema.safeParse(next);
    if (validated.success) {
      await tx.update(editorialSettings).set({ value: validated.data }).where(eq(editorialSettings.key, "taxonomy"));
      return true;
    }
    return false;
  });
}
