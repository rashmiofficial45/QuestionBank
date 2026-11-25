import { StudyFeed } from "@/components/study-feed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question bank" };

export default function QuestionBank(props: Pick<React.ComponentProps<typeof StudyFeed>, "searchParams">) {
  return <StudyFeed searchParams={props.searchParams} />;
}
