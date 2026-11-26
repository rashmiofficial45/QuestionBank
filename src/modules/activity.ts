import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/database";
import { attempts, practiceSessions, questions, studyDrills } from "@/database/schema";
import { activeQuestion } from "./study";

export async function activity(profile: string | null) {
  const day = sql<string>`to_char(${attempts.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`;
  const [total, counts, tests, drills] = await Promise.all([
    db.$count(questions, activeQuestion),
    profile ? db.select({ day, attempts: sql<number>`count(*)::int` }).from(attempts)
      .where(eq(attempts.profileId, profile)).groupBy(day).orderBy(day) : [],
    profile ? db.select({
      seconds: sql<number>`coalesce(sum(greatest(0, extract(epoch from (least(${practiceSessions.submittedAt}, ${practiceSessions.endsAt}) - ${practiceSessions.createdAt})))), 0)::int`,
      skipped: sql<number>`coalesce(sum(jsonb_array_length(${practiceSessions.manifest}) - (
        select count(*) from jsonb_each(${practiceSessions.responses}) as response(id, value)
        where response.value ? 'option' or response.value ? 'options'
      )), 0)::int`,
    }).from(practiceSessions).where(and(eq(practiceSessions.profileId, profile), isNotNull(practiceSessions.submittedAt))) : [],
    profile ? db.select({
      count: sql<number>`count(*)::int`,
      skipped: sql<number>`coalesce(sum(jsonb_array_length(${studyDrills.manifest}) - (
        select count(*) from jsonb_each(${studyDrills.responses}) as response(id, value)
        where response.value->>'answered' = 'true'
      )), 0)::int`,
    }).from(studyDrills).where(and(eq(studyDrills.profileId, profile), isNotNull(studyDrills.submittedAt))) : [],
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const end = Date.parse(today + "T00:00:00Z");
  const countsByDay = new Map(counts.map((row) => [row.day, row.attempts]));
  const dateAt = (daysBack: number) => new Date(end - daysBack * 86_400_000).toISOString().slice(0, 10);
  let streak = 0;
  for (let offset = countsByDay.has(today) ? 0 : 1; countsByDay.has(dateAt(offset)); offset++) streak++;
  const recent = Array.from({ length: 30 }, (_, index) => {
    const date = dateAt(29 - index);
    return { day: date, attempts: countsByDay.get(date) ?? 0 };
  });
  return {
    total, recent, streak, drillCount: drills[0]?.count ?? 0, drillSkipped: drills[0]?.skipped ?? 0, seconds: tests[0]?.seconds ?? 0, skipped: tests[0]?.skipped ?? 0,
    week: recent.slice(-7).reduce((sum, row) => sum + row.attempts, 0),
    month: recent.reduce((sum, row) => sum + row.attempts, 0),
  };
}
