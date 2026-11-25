import { TestHistory } from "@/components/test-history";
import { redirect } from "next/navigation";
import { PracticeSetup } from "@/components/practice-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activeSession, recentSessions } from "@/modules/practice";
import { getProfile, paperSources } from "@/modules/study";

export const dynamic = "force-dynamic";
export const metadata = { title: "Practice test" };

export default async function PracticePage() {
  const profile = await getProfile();
  if (profile) {
    const session = await activeSession(profile);
    if (session) redirect(`/practice/${session.id}`);
  }
  const [papers, history] = await Promise.all([paperSources(), profile ? recentSessions(profile) : []]);
  return <>
    <header className="study-heading mb-6"><div><h1>Practice test</h1><p>Work through one question at a time. Review your score and answers after submitting.</p></div></header>
    <Card className="shadow-none">
      <CardHeader><CardTitle>Test settings</CardTitle></CardHeader>
      <CardContent>{papers.length ? <PracticeSetup papers={papers} /> : <p className="text-muted-foreground">Publish questions to start a test.</p>}</CardContent>
    </Card>
    <TestHistory history={history} />
  </>;
}
