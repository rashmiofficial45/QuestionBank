export function summarizeTopics(rows: Array<{ subject: string; topic: string; correct: boolean | null }>) {
  const groups = new Map<string, { subject: string; topic: string; correct: number; incorrect: number; unanswered: number }>();
  for (const { subject, topic, correct } of rows) {
    const key = JSON.stringify([subject, topic]);
    const group = groups.get(key) ?? { subject, topic, correct: 0, incorrect: 0, unanswered: 0 };
    group[correct === null ? "unanswered" : correct ? "correct" : "incorrect"]++;
    groups.set(key, group);
  }
  return [...groups.values()];
}
