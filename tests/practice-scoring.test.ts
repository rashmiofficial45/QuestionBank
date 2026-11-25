import { expect, it } from "vitest";
import { scoreTest } from "../src/lib/practice-scoring";

it("uses integer thirds for the sample's negative marking and counts blanks separately", () => {
  const mark = scoreTest([{ answer: "a", selected: "a" }, { answer: "b", selected: "a" }, { answer: "c" }], 6, 2);
  expect(mark).toEqual({ correct: 1, incorrect: 1, unanswered: 1, points: 4, maximum: 18 });
});
