import { markRevision } from "@/app/(student)/actions";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProfile, revisionQueue } from "@/modules/study";

export const metadata = { title: "Revision" };

export default async function RevisionPage() {
  const profile = await getProfile();
  const queue = profile ? await revisionQueue(profile) : [];

  return <>
    <header className="study-heading mb-6">
      <div><h1>Revision</h1><p>Retry incorrect answers and revisit questions you marked for revision.</p></div>
      {queue[0] && <Button asChild><Link href={`/questions/${queue[0].slug}?from=revision`}>Start revision<ArrowRight /></Link></Button>}
    </header>
    <Card className="shadow-none">
      <CardHeader><CardTitle><h2>Questions to retry</h2></CardTitle></CardHeader>
      <CardContent>{queue.length ? <Table aria-label="Questions to retry">
        <TableHeader><TableRow><TableHead>Question</TableHead><TableHead>Subject and topic</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
        <TableBody>{queue.map((item) => <TableRow key={item.id}>
          <TableCell className="min-w-52 whitespace-normal"><strong>Question {item.number}</strong><p className="mt-1 line-clamp-2 text-muted-foreground">{item.searchText.split("\n")[0]}</p></TableCell>
          <TableCell className="whitespace-normal">{item.subject} · {item.topic}</TableCell>
          <TableCell><Button asChild variant="outline" size="sm"><Link href={`/questions/${item.slug}?from=revision`} aria-label={`Retry question ${item.number}`}>Retry<ArrowRight /></Link></Button>{item.manuallyMarked && <form className="mt-1" action={markRevision.bind(null, item.id, false)}><Button size="sm" variant="ghost">Unmark</Button></form>}</TableCell>
        </TableRow>)}</TableBody>
      </Table> : <p className="text-sm text-muted-foreground">Questions appear here when your latest attempt is incorrect.</p>}</CardContent>
    </Card>
  </>;
}
