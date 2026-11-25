import { expect, it } from "vitest";
import { scoreTest } from "../src/lib/practice-scoring";

it("uses integer thirds for the sample's negative marking and counts blanks separately", () => {
  const mark = scoreTest([{ answer: "a", selected: "a" }, { answer: "b", selected: "a" }, { answer: "c" }], 6, 2);
  expect(mark).toEqual({ correct: 1, incorrect: 1, unanswered: 1, points: 4, maximum: 18 });
});

it("uses the same score calculation for history and treats no attempts as missing accuracy", async () => {
  const { scoreCounts, testAccuracy } = await import("../src/lib/practice-scoring");
  expect(scoreCounts(1, 2, 50, 6, 2)).toEqual({
    correct: 1, incorrect: 2, unanswered: 47, points: 2, maximum: 300,
  });
  expect(testAccuracy(1, 2)).toBe(33);
  expect(testAccuracy(0, 0)).toBeNull();
});
