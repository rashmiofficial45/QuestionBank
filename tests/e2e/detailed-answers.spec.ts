import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { polityDetailedPaper, textPdfFixture } from "./detailed-fixture";

for (const withExplanation of [false, true]) {
  test(`imports an answer PDF ${withExplanation ? "with a separate explanation section" : "containing only the key"}`, async ({ page }) => {
    test.skip(process.env.EDITORIAL_TEST_DATABASE !== "1", "Use an isolated database.");
    const title = `Two PDF format ${withExplanation ? "mixed" : "key"} ${Date.now()}`;
    await page.goto("/admin/imports/new");
    await expect(page.locator('input[type="file"]')).toHaveCount(2);
    await page.getByLabel("Paper title").fill(title);
    await page.getByLabel("Subject").fill("General");
    await page.getByLabel("Questions PDF", { exact: true }).setInputFiles(
      textPdfFixture(["1. Which number is even?", "(a) One", "(b) Two"], "questions.pdf"),
    );
    const answer = textPdfFixture(["Answer Key", "1. B", ...(withExplanation ? ["Explanations", "1. Two is divisible by two."] : [])]);
    await page.locator(".pdf-drop-zone").filter({ hasText: "Answers PDF" }).evaluate((zone, bytes) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], "dropped-answers.pdf", { type: "application/pdf" }));
      zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, [...answer.buffer]);
    await expect(page.getByText("dropped-answers.pdf", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Upload and process" }).click();
    await expect(page.getByText(/1 extracted.*1 flagged/)).toBeVisible({ timeout: 35_000 });
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Correct answer" })).toHaveValue("b");
    await page.getByRole("checkbox", { name: /verified this draft/ }).check();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    await page.getByRole("link", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Publish 1 question", exact: true }).click();
    await expect(page.getByText("1 question published to the student bank.")).toBeVisible();
    await page.goto(`/questions?${new URLSearchParams({ source: title })}`);
    const question = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Question 1", exact: true }) });
    await question.getByRole("button", { name: "B. Two", exact: true }).click();
    await expect(question.getByRole("alert")).toContainText("Correct answer");
    if (withExplanation) {
      const crop = page.locator("details[open]").getByRole("img", { name: /Original detailed explanation/ });
      await crop.scrollIntoViewIfNeeded();
      await expect.poll(() => crop.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(200);
    } else {
      await expect(page.getByText("Detailed explanation", { exact: true })).toHaveCount(0);
    }
  });
}

test("imports a Vision booklet with inline answers and shows the original explanations", async ({ page }) => {
  const sources = process.env.VISION_FIXTURE_DIR;
  test.skip(!sources || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use an isolated database and the Vision 15601 PDFs.");
  const title = `Vision 15601 ${Date.now()}`;
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(title);
  await page.getByLabel("Subject").fill("General Studies");
  await page.getByLabel("Questions PDF", { exact: true }).setInputFiles(join(sources!, "Test 01 (15601) Eng QP.pdf"));
  await page.getByLabel("Answers PDF").setInputFiles(join(sources!, "Test 01 (15601) Eng Sol.pdf"));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText("100 extracted · 100 ready to publish · 0 flagged · 0 published")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("link", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish 100 questions", exact: true }).click();
  await expect(page.getByText("100 questions published to the student bank.")).toBeVisible();

  await page.goto(`/questions?${new URLSearchParams({ source: title })}`);
  const third = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Question 3", exact: true }) });
  await expect(third.getByText("Detailed explanation", { exact: true })).toHaveCount(0);
  await third.getByRole("button", { name: /^A\./ }).click();
  await expect(third.getByRole("alert")).toContainText("Incorrect answer");
  const continuation = third.locator("details[open]").getByRole("img", { name: "Original detailed explanation, PDF page 2" });
  await continuation.scrollIntoViewIfNeeded();
  await expect.poll(() => continuation.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(200);
  await third.getByRole("button", { name: "Try again" }).click();
  await third.getByRole("button", { name: /^C\./ }).click();
  await expect(third.getByRole("alert")).toContainText("Correct answer");
  await expect(continuation).toBeVisible();
});

test("publishes the combined Polity answer PDF and reveals original explanations after grading", async ({ page, browser }) => {
  const sources = process.env.POLITY_FIXTURE_DIR;
  test.skip(!sources || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use an isolated database and the supplied Polity PDFs.");
  const title = `Detailed Polity ${Date.now()}`;
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(title);
  await page.getByLabel("Subject").fill("Polity");
  const paper = page.getByLabel("Questions PDF", { exact: true });
  const detailed = page.getByLabel("Answers PDF", { exact: true });
  await expect(paper).toHaveAttribute("required", "");
  await expect(detailed).toHaveAttribute("required", "");
  await paper.setInputFiles(join(sources!, "Test-01-Polity-01-QP-23-Nov-.pdf"));
  await detailed.setInputFiles(join(sources!, polityDetailedPaper));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/50 ready to publish/)).toBeVisible({ timeout: 60_000 });
  const importId = new URL(page.url()).pathname.split("/").at(-1);
  const image = `/api/v1/source/${importId}/answer-1-1.png`;
  const otherImage = `/api/v1/source/${importId}/answer-2-1.png`;
  await page.getByRole("link", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish 50 questions" }).click();
  await expect(page.getByText("50 questions published to the student bank.")).toBeVisible();

  await page.goto(`/questions?${new URLSearchParams({ source: title })}`);
  const first = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Question 1", exact: true }) });
  await expect(first.getByText("Detailed explanation")).toHaveCount(0);
  expect((await page.request.get(image)).status()).toBe(404);
  await first.getByRole("button", { name: "A. Article 1", exact: true }).click();
  await expect(first.getByRole("alert")).toContainText("Incorrect answer");
  await expect(first.locator("details[open] > summary")).toHaveText("Detailed explanation");
  for (const pageNumber of [2, 3]) {
    const crop = first.getByRole("img", { name: `Original detailed explanation, PDF page ${pageNumber}` });
    await crop.scrollIntoViewIfNeeded();
    await expect.poll(() => crop.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(200);
  }
  expect((await page.request.get(otherImage)).status()).toBe(404);
  await first.getByRole("button", { name: "Try again" }).click();
  await first.getByRole("button", { name: "B. Article 2", exact: true }).click();
  await expect(first.getByRole("alert")).toContainText("Correct answer");
  const correctCrop = first.locator("details[open]").getByRole("img", { name: "Original detailed explanation, PDF page 2" });
  await correctCrop.scrollIntoViewIfNeeded();
  await expect.poll(() => correctCrop.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(200);

  const testContext = await browser.newContext();
  try {
    const testPage = await testContext.newPage();
    const app = new URL(page.url()).origin;
    await testPage.goto(`${app}/practice`);
    await testPage.getByLabel("Paper", { exact: true }).selectOption(title);
    await testPage.getByRole("button", { name: "Start test" }).click();
    await expect(testPage.getByRole("heading", { name: "Question 1 of 50" })).toBeVisible();
    const session = new URL(testPage.url()).pathname.split("/").at(-1);
    const withSession = new URL(`${image}?test=${session}`, app).toString();
    expect((await testPage.request.get(withSession)).status()).toBe(404);
    await testPage.getByRole("button", { name: "A. Article 1", exact: true }).click();
    await expect(testPage.getByText("1 of 50 answered", { exact: true })).toBeVisible();
    testPage.once("dialog", (dialog) => dialog.accept());
    await testPage.getByRole("button", { name: "Submit test" }).click();
    await testPage.getByRole("link", { name: "Review answers" }).click();
    await expect(testPage.locator("details[open] > summary")).toHaveText("Detailed explanation");
    expect((await testPage.request.get(withSession)).status()).toBe(200);
    expect((await page.request.get(new URL(`${otherImage}?test=${session}`, app).toString())).status()).toBe(404);
  } finally {
    await testContext.close();
  }
});
