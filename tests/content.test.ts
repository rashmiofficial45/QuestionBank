import { describe, expect, it } from "vitest";
import { publicationIssues, questionSchema, validSelection, type Content } from "../src/lib/content";

const question: Content = {
  version: 1, interaction: "single_choice",
  blocks: [{ id: "stem", type: "paragraph", text: "Which option is correct?" }],
  options: [{ id: "a", label: "A", text: "First option" }, { id: "b", label: "B", text: "Second option" }],
  answer: "b", explanation: "",
};

describe("publication contract", () => {
  it("accepts valid content and keeps the official answer stable when options move", () => {
    const reordered = questionSchema.parse({ ...question, options: [...question.options].reverse() });
    expect(publicationIssues(reordered)).toEqual([]);
    expect(reordered.answer).toBe("b");
  });

  it("blocks duplicate options and missing answers", () => {
    expect(publicationIssues({ ...question, options: [question.options[0], question.options[0]] })).toHaveLength(2);
    expect(publicationIssues({ ...question, answer: null })).toHaveLength(1);
  });

  it("rejects invalid source references", () => {
    expect(questionSchema.safeParse({ ...question, blocks: [{ id: "source", type: "source_crop", page: 2, file: "../../paper.pdf", alt: "Paper" }] }).success).toBe(false);
  });

  it("requires one True and one False option and accepts only one selection", () => {
    const binary = questionSchema.parse({
      ...question, interaction: "true_false",
      options: [{ id: "a", label: "A", text: "FALSE" }, { id: "b", label: "B", text: " True " }],
    });
    expect(publicationIssues(binary)).toEqual([]);
    expect(validSelection(binary, ["b"])).toEqual(["b"]);
    expect(validSelection(binary, ["a", "b"])).toBeNull();
    expect(publicationIssues({ ...binary, options: [...binary.options, { id: "c", label: "C", text: "Maybe" }] }))
      .toContain("True/False questions need exactly one True option and one False option.");
  });
});
