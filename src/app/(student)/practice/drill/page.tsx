import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/database";
import { questions, studyDrills } from "@/database/schema";
import { activeQuestion, getProfile, subjects } from "@/modules/study";
import { DrillSetup } from "@/components/drill-setup";

export default async function DrillPage() {
  const profile = await getProfile();
  const [groups, topics, recent] = await Promise.all([
    subjects(),
    db.selectDistinct({ topic: questions.topic }).from(questions).where(activeQuestion).orderBy(questions.topic),
    profile ? db.select().from(studyDrills).where(eq(studyDrills.profileId, profile)).orderBy(desc(studyDrills.createdAt)).limit(10) : [],
  ]);
  return <>
    <Link className="text-link workspace-back" href="/practice">Back to timed tests</Link>
    <div className="page-heading"><h1>Untimed practice</h1><p>Build a question set and get feedback after each answer.</p></div>
    <section className="panel bank-panel"><h2>Practice settings</h2><DrillSetup subjects={groups.map(({ name }) => name)} topics={topics.map(({ topic }) => topic)} /></section>
    {recent.length > 0 && <section className="panel bank-panel admin-section"><h2>Recent practice sets</h2>
      <ul className="grid gap-3 mt-3">{recent.map((item) => <li key={item.id}><Link href={`/practice/drill/${item.id}`} className="text-link">
        {item.submittedAt ? "Review" : "Resume"} {item.manifest.length}-question set · {item.createdAt.toLocaleDateString("en-IN")}
      </Link></li>)}</ul>
    </section>}
  </>;
}
