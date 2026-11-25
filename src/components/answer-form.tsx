"use client";

import { ArrowRight, Check, CircleCheck, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { submitAnswer } from "@/app/(student)/actions";
import type { Content } from "@/lib/content";

export function AnswerForm({ id, options, next }: { id: string; options: Content["options"]; next?: string }) {
  const [round, setRound] = useState(0);
  return <AnswerRound key={round} id={id} options={options} next={next} retry={() => setRound(round + 1)} />;
}

function AnswerRound({ id, options, next, retry }: { id: string; options: Content["options"]; next?: string; retry: () => void }) {
  const [selected, select] = useState("");
  const [result, action, pending] = useActionState(submitAnswer.bind(null, id), {});
  return <form action={action} className="answer-form">
    <fieldset disabled={pending || Boolean(result.answer)}>
      <legend>Select one answer</legend>
      {options.map((option) => <label key={option.id} className={`option ${selected === option.id ? "option-selected" : ""} ${result.answer === option.id ? "option-correct" : ""} ${result.answer && selected === option.id && !result.correct ? "option-incorrect" : ""}`}>
        <input type="radio" name="option" value={option.id} checked={selected === option.id} onChange={() => select(option.id)} />
        <span className="option-letter">{option.label}</span><span>{option.text}</span>
        {result.answer === option.id ? <Check size={18} /> : result.answer && selected === option.id ? <X size={18} /> : <span className="option-radio" />}
      </label>)}
    </fieldset>
    <div aria-live="polite">
      {result.error && <p className="form-error">{result.error}</p>}
      {result.answer && <div className={`feedback ${result.correct ? "feedback-correct" : ""}`}><strong>{result.correct ? "Correct answer" : `The correct answer is ${options.find((option) => option.id === result.answer)?.label}.`}</strong>{result.explanation && <p>{result.explanation}</p>}</div>}
    </div>
    <div className="form-actions">
      {result.answer
        ? <><Button type="button" variant="outline" onClick={retry}><RotateCcw size={16} /> Try again</Button>{next && <Button asChild><Link href={next}>Next question <ArrowRight size={17} /></Link></Button>}</>
        : <Button type="submit" disabled={!selected || pending}><CircleCheck size={16} />{pending ? "Checking…" : "Check answer"}</Button>}
    </div>
  </form>;
}
