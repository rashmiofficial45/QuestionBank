"use client";

import { ArrowRight, Check, CircleCheck, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { SearchHighlight } from "@/components/search-highlight";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { submitAnswer } from "@/app/(student)/actions";
import type { Content } from "@/lib/content";

type Props = { terms?: string[]; id: string; revision: number; options: Content["options"]; next?: string; inline?: boolean; mode?: "practice" | "bank" };

export function AnswerForm(props: Props) {
  const [round, setRound] = useState(0);
  return <AnswerRound key={round} {...props} retry={() => setRound(round + 1)} />;
}

function AnswerRound({ id, revision, options, next, terms, inline = false, mode = "bank", retry }: Props & { retry: () => void }) {
  const [selected, select] = useState("");
  const [result, action, pending] = useActionState(submitAnswer.bind(null, id, revision, mode), {});
  const answer = options.find((option) => option.id === result.answer);
  return <form action={action} className="answer-form">
    <fieldset disabled={pending || Boolean(answer)}>
      <legend className={inline ? "sr-only" : undefined}>Select one answer</legend>
      {options.map((option) => {
        const correct = option.id === result.answer;
        const incorrect = answer && option.id === result.selected && !correct;
        const state = correct ? "option-correct" : incorrect ? "option-incorrect" : "";
        const content = <>
          <span className="option-letter">{option.label}.</span><span><SearchHighlight text={option.text} terms={terms} /></span>
          {correct ? <Check size={17} aria-label="Correct" /> : incorrect ? <X size={17} aria-label="Your answer was incorrect" /> : !inline && <span className="option-radio" />}
        </>;
        return inline
          ? <Button key={option.id} className={`option inline-option ${state}`} variant="ghost" type="submit" name="option" value={option.id}>{content}</Button>
          : <label key={option.id} className={`option ${selected === option.id ? "option-selected" : ""} ${state}`}>
              <input type="radio" name="option" value={option.id} checked={selected === option.id} onChange={() => select(option.id)} />{content}
            </label>;
      })}
    </fieldset>
    <div aria-live="polite">
      {result.error && <p className="form-error">{result.error}</p>}
      {answer && <Alert className={`answer-result mt-3 ${result.correct ? "answer-correct" : "answer-incorrect"}`}>
        {result.correct ? <Check /> : <X />}
        <AlertTitle>{result.correct ? "Correct answer" : "Incorrect answer"}</AlertTitle>
        <AlertDescription>Correct option: {answer.label}. {answer.text}</AlertDescription>
      </Alert>}
      {answer && result.explanation && <details className="source-text rounded-md border p-3"><summary>Explanation</summary><p>{result.explanation}</p></details>}
    </div>
    {inline && !answer && <p className="mt-2 text-xs text-muted-foreground">Choose an option to check your answer.</p>}
    {(!inline || answer) && <div className="form-actions">
      {answer
        ? <><Button type="button" variant="outline" size="sm" onClick={retry}><RotateCcw /> Try again</Button>{next && <Button asChild><Link href={next}>Next question <ArrowRight /></Link></Button>}</>
        : <Button type="submit" disabled={!selected || pending}><CircleCheck />{pending ? "Checking…" : "Check answer"}</Button>}
    </div>}
  </form>;
}
