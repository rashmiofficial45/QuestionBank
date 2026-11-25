import { expect, it } from "vitest";
import { pageWindow, searchSegments } from "../src/lib/study-controls";

it("keeps first and last pages in the numbered navigation", () => {
  expect(pageWindow(5, 12)).toEqual([1, "gap", 4, 5, 6, "gap", 12]);
  expect(pageWindow(1, 7)).toEqual([1, 2, 3, "gap", 7]);
  expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
});

it("highlights escaped queries and preserves the original capitalization", () => {
  expect(searchSegments("Andaman Sea and seats.", ["sea"])).toEqual([
    { text: "Andaman ", match: false }, { text: "Sea", match: true },
    { text: " and ", match: false }, { text: "sea", match: true }, { text: "ts.", match: false },
  ]);
  expect(searchSegments("C++ and C", ["C++"]).filter((part) => part.match).map((part) => part.text)).toEqual(["C++"]);
});
