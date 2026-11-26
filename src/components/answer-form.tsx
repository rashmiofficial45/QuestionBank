"use client";

import { ArrowRight, Check, CircleCheck, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { OptionContent } from "@/components/option-content";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { submitAnswer, type AnswerState } from "@/app/(student)/actions";
import type { Content } from "@/lib/content";
import { choiceIds } from "@/lib/choice-selection";
import { isWritten, type WrittenInteraction } from "@/lib/written-answer";
import { Textarea } from "@/components/ui/textarea";
import { isRanked } from "@/lib/ranked-answer";
import { RankedFields, rankedLabels } from "@/components/ranked-fields";

type Props = { terms?: string[]; id: string; importId?: string | null; revision: number; options: Content["options"]; interaction: Content["interaction"]; prompts?: string[]; next?: string; inline?: boolean; mode?: "practice" | "bank" };

export function AnswerForm(props: Props) {
  const [round, setRound] = useState(0);
  if (isWritten(props.interaction)) return <WrittenRound key={round} {...props} interaction={props.interaction} retry={() => setRound(round + 1)} />;
  if (isRanked(props.interaction)) return <RankedRound key={round} {...props} retry={() => setRound(round + 1)} />;
  return <AnswerRound key={round} {...props} retry={() => setRound(round + 1)} />;
}

function RankedRound({ id, revision, mode = "bank", options, prompts, retry, next }: Props & { retry: () => void }) {
  const [result, action, pending] = useActionState(submitAnswer.bind(null, id, revision, mode), {});
  return <form action={action} className="answer-form grid gap-3">
    <fieldset disabled={pending || Boolean(result.answer)}>
      <legend>{prompts ? "Match each prompt" : "Place items in order"}</legend>
      <RankedFields key={result.answer ? "review" : "answer"} options={options} prompts={prompts} selected={choiceIds(result.selected)} />
    </fieldset>
    {result.error && <p className="form-error" role="alert">{result.error}</p>}
    {result.answer ? <>
      <Alert className={`answer-result ${result.correct ? "answer-correct" : "answer-incorrect"}`}>
        <AlertTitle>{result.correct ? "Correct answer" : "Incorrect answer"}</AlertTitle>
        <AlertDescription className="whitespace-pre-wrap">{rankedLabels(options, choiceIds(result.answer), prompts)}</AlertDescription>
      </Alert>
      {result.explanation && <details><summary>Explanation</summary><p>{result.explanation}</p></details>}
      <div className="form-actions"><Button type="button" variant="outline" onClick={retry}>Try again</Button>
        {next && <Button asChild><Link href={next}>Next question <ArrowRight /></Link></Button>}</div>
    </> : <Button type="submit" disabled={pending} className="justify-self-start">Check answer</Button>}
  </form>;
}

function WrittenRound({ id, revision, interaction, mode = "bank", retry, next }: Props & { interaction: WrittenInteraction; retry: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [response, setResponse] = useState("");
  const [result, setResult] = useState<AnswerState>({});
  const [pending, startSubmission] = useTransition();
  const descriptive = interaction === "descriptive";
  return <form className="answer-form grid gap-3" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmission(async () => setResult(await submitAnswer(id, revision, mode, {}, data)));
  }}>
    <label className="field">Your response
      <Textarea name="option" aria-label="Your response" value={response} onChange={(event) => setResponse(event.target.value)}
        inputMode={interaction === "numeric" ? "decimal" : undefined} rows={descriptive ? 5 : 2} maxLength={8000}
        disabled={!ready} readOnly={Boolean(result.answer)} required />
    </label>
    {result.error && <p className="form-error" role="alert">{result.error}</p>}
    {result.answer ? <>
      <Alert className={descriptive ? undefined : `answer-result ${result.correct ? "answer-correct" : "answer-incorrect"}`}>
        <AlertTitle>{descriptive ? "Reference answer" : result.correct ? "Correct answer" : "Incorrect answer"}</AlertTitle>
        <AlertDescription className="whitespace-pre-wrap">{result.answer}</AlertDescription>
      </Alert>
      {descriptive && <p className="text-sm text-muted-foreground">Compare your response with the reference answer.</p>}
      {result.explanation && <details className="source-text"><summary>Explanation</summary><p>{result.explanation}</p></details>}
      <div className="form-actions"><Button type="button" variant="outline" onClick={retry}>Try again</Button>
        {next && <Button asChild><Link href={next}>Next question <ArrowRight /></Link></Button>}</div>
    </> : <Button type="submit" disabled={!ready || pending || !response.trim()} className="justify-self-start">{descriptive ? "Reveal reference answer" : "Check answer"}</Button>}
  </form>;
}

function AnswerRound({ id, importId, revision, options, interaction, next, terms, inline = false, mode = "bank", retry }: Props & { retry: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [selected, select] = useState<string[]>([]);
  const [result, action, pending] = useActionState(submitAnswer.bind(null, id, revision, mode), {});
  const answerIds = choiceIds(result.answer);
  const answers = options.filter((option) => answerIds.includes(option.id));
  const graded = answers.length > 0;
  const multiple = interaction === "multiple_choice";
  const prompt = interaction === "true_false" ? "Select True or False" : multiple ? "Select all correct answers" : "Select one answer";
  const immediate = inline && !multiple;
  return <form action={action} className="answer-form">
    <fieldset disabled={!ready || pending || graded}>
      <legend className={immediate ? "sr-only" : undefined}>{prompt}</legend>
      {options.map((option) => {
        const correct = answerIds.includes(option.id);
        const incorrect = graded && choiceIds(result.selected).includes(option.id) && !correct;
        const state = correct ? "option-correct" : incorrect ? "option-incorrect" : "";
        const checked = selected.includes(option.id);
        const content = <>
          <span className="option-letter">{option.label}.</span><OptionContent option={option} importId={importId} terms={terms} />
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
