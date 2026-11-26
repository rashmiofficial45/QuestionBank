"use client";

import { ArrowRight, Check, CircleCheck, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { SearchHighlight } from "@/components/search-highlight";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { submitAnswer } from "@/app/(student)/actions";
import type { Content } from "@/lib/content";
import { choiceIds } from "@/lib/choice-selection";

type Props = { terms?: string[]; id: string; revision: number; options: Content["options"]; interaction: Content["interaction"]; next?: string; inline?: boolean; mode?: "practice" | "bank" };

export function AnswerForm(props: Props) {
  const [round, setRound] = useState(0);
  return <AnswerRound key={round} {...props} retry={() => setRound(round + 1)} />;
}

function AnswerRound({ id, revision, options, interaction, next, terms, inline = false, mode = "bank", retry }: Props & { retry: () => void }) {
  const [selected, select] = useState<string[]>([]);
  const [result, action, pending] = useActionState(submitAnswer.bind(null, id, revision, mode), {});
  const answerIds = choiceIds(result.answer);
  const answers = options.filter((option) => answerIds.includes(option.id));
  const graded = answers.length > 0;
  const multiple = interaction === "multiple_choice";
  const prompt = interaction === "true_false" ? "Select True or False" : multiple ? "Select all correct answers" : "Select one answer";
  const immediate = inline && !multiple;
  return <form action={action} className="answer-form">
    <fieldset disabled={pending || graded}>
      <legend className={immediate ? "sr-only" : undefined}>{prompt}</legend>
      {options.map((option) => {
        const correct = answerIds.includes(option.id);
        const incorrect = graded && choiceIds(result.selected).includes(option.id) && !correct;
        const state = correct ? "option-correct" : incorrect ? "option-incorrect" : "";
        const checked = selected.includes(option.id);
        const content = <>
          <span className="option-letter">{option.label}.</span><span><SearchHighlight text={option.text} terms={terms} /></span>
          {correct ? <Check size={17} aria-label="Correct" /> : incorrect ? <X size={17} aria-label="Your answer was incorrect" /> : !inline && !multiple && <span className="option-radio" />}
        </>;
        return immediate
          ? <Button key={option.id} className={`option inline-option ${state}`} variant="ghost" type="submit" name="option" value={option.id}>{content}</Button>
          : <label key={option.id} className={`option ${multiple ? "option-checkbox" : ""} ${checked ? "option-selected" : ""} ${state}`}>
              <input type={multiple ? "checkbox" : "radio"} name="option" value={option.id} checked={checked}
                onChange={() => select(multiple ? (checked ? selected.filter((value) => value !== option.id) : [...selected, option.id]) : [option.id])} />{content}
            </label>;
      })}
    </fieldset>
    <div aria-live="polite">
      {result.error && <p className="form-error">{result.error}</p>}
      {graded && <Alert className={`answer-result mt-3 ${result.correct ? "answer-correct" : "answer-incorrect"}`}>
        {result.correct ? <Check /> : <X />}
        <AlertTitle>{result.correct ? "Correct answer" : "Incorrect answer"}</AlertTitle>
        <AlertDescription>{answers.length === 1 ? "Correct option: " : "Correct options: "}{answers.map((answer) => `${answer.label}. ${answer.text}`).join("; ")}</AlertDescription>
      </Alert>}
      {graded && result.explanation && <details className="source-text rounded-md border p-3"><summary>Explanation</summary><p>{result.explanation}</p></details>}
    </div>
    {immediate && !graded && <p className="mt-2 text-xs text-muted-foreground">Choose an option to check your answer.</p>}
    {(!immediate || graded) && <div className="form-actions">
      {graded
        ? <><Button type="button" variant="outline" size="sm" onClick={retry}><RotateCcw /> Try again</Button>{next && <Button asChild><Link href={next}>Next question <ArrowRight /></Link></Button>}</>
        : <Button type="submit" disabled={!selected.length || pending}><CircleCheck />{pending ? "Checking…" : "Check answer"}</Button>}
    </div>}
  </form>;
}
