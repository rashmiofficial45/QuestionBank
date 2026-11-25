import { Bookmark } from "lucide-react";
import { QuestionList } from "@/components/question-list";
import { savedQuestions } from "@/modules/study";

export const metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  return <>
    <div className="page-heading"><span className="tile-icon"><Bookmark size={21} /></span><h1>Bookmarks</h1><p>Return to questions you saved for another session.</p></div>
    <section className="panel bank-panel"><QuestionList items={await savedQuestions()} empty="Bookmark a question to save it here." /></section>
  </>;
}
