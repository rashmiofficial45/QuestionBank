import { performance } from "node:perf_hooks";
import { sql } from "drizzle-orm";
import { db } from "../src/database";
import { browse, questionBySlug } from "../src/modules/study";

const runs = 25;

async function measure(label: string, action: () => Promise<unknown>) {
  await action();
  const values = [];
  for (let n = 0; n < runs; n++) {
    const start = performance.now();
    await action();
    values.push(performance.now() - start);
  }
  values.sort((a, b) => a - b);
  console.log(JSON.stringify({ label, p50Ms: +values[Math.floor(runs / 2)].toFixed(2), p95Ms: +values[Math.ceil(runs * 0.95) - 1].toFixed(2) }));
}

async function main() {
  const [database] = await db.execute<{ name: string; version: string }>(sql`select current_database() as name, current_setting('server_version') as version`);
  if (database?.name !== "question_bank_benchmark") throw new Error("Use a disposable database named question_bank_benchmark.");
  if (process.argv.includes("--concurrent")) {
    const timings: number[] = [];
    await Promise.all(Array.from({ length: 8 }, async () => {
      for (let index = 0; index < 25; index++) {
        const start = performance.now();
        const results = await browse(index % 2 ? "microplate" : "constitutional", "Benchmark subject");
        if (results.count < 100) throw new Error("Run the 50,000-question seed first.");
        timings.push(performance.now() - start);
      }
    }));
    timings.sort((a, b) => a - b);
    console.log(JSON.stringify({ label: "8 readers during extraction", calls: timings.length,
      p50Ms: +timings[Math.floor(timings.length / 2)].toFixed(2),
      p95Ms: +timings[Math.ceil(timings.length * 0.95) - 1].toFixed(2) }));
    return;
  }
  const [existing] = await db.execute<{ count: number }>(sql`select count(*)::int as count from published_questions`);
  if (existing.count > 0) throw new Error("The benchmark requires an empty question bank.");
  console.log(JSON.stringify({ database, runs }));
  for (const [start, end] of [[1, 5000], [5001, 50000]]) {
    await db.execute(sql`
      insert into published_questions (slug, subject, topic, source, difficulty, number, content, search_text)
      select 'benchmark-' || i, 'Benchmark subject', 'Topic ' || (i % 50), 'Synthetic paper ' || (i / 100),
        'Unrated', i,
        jsonb_build_object('version', 1, 'interaction', 'single_choice', 'answer', 'a', 'explanation', '',
          'options', '[{"id":"a","label":"A","text":"Yes"},{"id":"b","label":"B","text":"No"}]'::jsonb,
          'blocks', jsonb_build_array(jsonb_build_object('id','stem','type','paragraph','text','Synthetic prompt ' || i))),
        'Constitutional studies ' || i || ' ' || (case when i % 500 = 0 then 'microplate' else 'electoral' end)
      from generate_series(${start}::int, ${end}::int) i
      on conflict (slug) do nothing
    `);
    await db.execute(sql`analyze published_questions`);
    const selective = await browse("microplate", "Benchmark subject");
    if (selective.count !== end / 500 || !(await questionBySlug("benchmark-2500"))) throw new Error("Benchmark data did not match expected counts.");
    await measure(`${end}: selective search`, () => browse("microplate", "Benchmark subject"));
    await measure(`${end}: broad search`, () => browse("constitutional", "Benchmark subject"));
    await measure(`${end}: question lookup`, () => questionBySlug("benchmark-2500"));
  }
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
