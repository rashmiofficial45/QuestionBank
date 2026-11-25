import { expect, it } from "vitest";
import { questionSchema } from "../src/lib/content";

const question = {
  version: 1, interaction: "single_choice", options: [], answer: null, explanation: "",
  blocks: [
    { id: "stem", type: "paragraph", text: "Read the table." },
    { id: "table", type: "table", page: 2, bounds: [1, 2, 3, 4], headers: ["Body", "Duty"], rows: [["Courts", "Interpret laws"]] },
  ],
};

it("accepts a source-linked rectangular table and rejects a row with missing cells", () => {
  const valid = questionSchema.parse(question);
  expect(valid.blocks[1].type).toBe("table");
  expect(questionSchema.safeParse({ ...question, blocks: [{ ...question.blocks[1], rows: [["Courts"]] }] }).success).toBe(false);
});
