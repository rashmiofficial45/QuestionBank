import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { polityDetailedPaper } from "./detailed-fixture";

const capture = process.env.PREVIEW_SCREENSHOT_DIR;
const scanFixture = process.env.SCAN_FIXTURE_DIR;

test("renders interactive cards in both themes, including structured tables and practice history", async ({ page }) => {
  await page.goto("/questions");
  await expect(page.getByRole("heading", { name: "Question bank" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bookmark question 1" })).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.reload();
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "questions-white.png") });

  await page.getByRole("button", { name: "Toggle black and white theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  if (capture) await page.screenshot({ path: join(capture, "questions-black.png") });

  await page.getByLabel("Question format").selectOption("table");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const first = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Question 6", exact: true }) });
  await expect(first.getByRole("table")).toBeVisible();
  await expect(first.getByRole("cell", { name: "House Committee", exact: true })).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "structured-tables.png") });

  await page.goto("/questions?subject=Polity&format=statements&q=Fundamental");
  const statementCard = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Question 9", exact: true }) });
  const statements = statementCard.getByRole("list", { name: "Statements" });
  await expect(statements.getByRole("listitem")).toHaveCount(4);
  await expect(statements.locator("mark").filter({ hasText: "Fundamental" })).toBeVisible();
  await expect(statementCard.getByText(/How many of the above provisions/)).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "statement-questions.png") });

  await page.goto("/questions?q=sea");
  await expect(page.locator("mark").filter({ hasText: /^Sea$/ }).first()).toBeVisible();
  const bank = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Question 1", exact: true }) });
  await bank.locator('button[name="option"][value="a"]').click();
  await expect(bank.getByRole("alert")).toContainText("Incorrect answer");
  await expect(bank.locator(".option-incorrect")).toBeVisible();
  await expect(bank.locator(".option-correct")).toBeVisible();
  await expect(bank.getByText("Explanation", { exact: true })).toHaveCount(0);
  if (capture) await page.screenshot({ path: join(capture, "answer-feedback.png") });

  await page.goto("/questions?subject=Polity");
  const pagination = page.getByRole("navigation", { name: "Question pages" });
  await pagination.getByRole("link", { name: "Page 2" }).click();
  await expect(pagination.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(/subject=Polity.*page=2/);
  await expect(page.getByRole("link", { name: "Question 9", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 50" })).toBeVisible();
  await page.getByRole("button", { name: "Maximize test" }).click();
  await expect(page.locator(".sidebar, .topbar")).toHaveCount(2);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".topbar")).toBeHidden();
  if (capture) await page.screenshot({ path: join(capture, "test-focus.png") });
  await page.getByRole("button", { name: "Minimize test" }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
  const palette = page.getByRole("navigation", { name: "Jump to a test question" });
  await expect(palette.locator(".test-step")).toHaveCount(50);
  const questionStrip = page.locator(".test-palette-scroll");
  await expect(questionStrip).toHaveCSS("scrollbar-width", "none");
  await expect(page.locator("html")).toHaveCSS("scrollbar-width", "none");
  await expect(palette.getByRole("button", { name: "Previous question" })).toBeDisabled();
  await palette.getByRole("link", { name: "Question 6, unanswered" }).click();
  await palette.getByRole("link", { name: "Previous question" }).click();
  await expect(page.getByRole("heading", { name: "Question 5 of 50" })).toBeVisible();
  await palette.getByRole("link", { name: "Previous question" }).click();
  await expect(page.getByRole("heading", { name: "Question 4 of 50" })).toBeVisible();
  await expect.poll(() => questionStrip.evaluate((rail) => rail.scrollLeft)).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const number of [5, 6, 7, 8]) {
    await palette.getByRole("link", { name: "Next question" }).click();
    await expect(page.getByRole("heading", { name: `Question ${number} of 50` })).toBeVisible();
  }
  await expect.poll(() => questionStrip.evaluate((rail) => rail.scrollLeft)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await palette.getByRole("link", { name: "Question 1, unanswered", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 50" })).toBeVisible();
  const optionA = page.locator('button[name="option"][value="a"]');
  const optionB = page.locator('button[name="option"][value="b"]');
  await page.keyboard.press("ArrowDown");
  await expect(optionA).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(optionB).toBeFocused();
  await expect(optionB).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("ArrowUp");
  await expect(optionA).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(palette.getByRole("link", { name: "Question 1, answered", exact: true })).toBeVisible();
  await expect(page.getByText("Incorrect answer", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mark for review" }).click();
  await expect(palette.getByRole("link", { name: "Question 1, answered, marked for review" })).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "practice-test.png") });
  await page.keyboard.down("ArrowRight");
  await expect(page.getByRole("heading", { name: "Question 2 of 50" })).toBeVisible();
  await page.keyboard.down("ArrowRight");
  await expect(page.getByRole("heading", { name: "Question 3 of 50" })).toBeVisible();
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "Question 2 of 50" })).toBeVisible();
  await palette.getByRole("link", { name: "Question 50, unanswered" }).click();
  await expect(page.getByRole("heading", { name: "Question 50 of 50" })).toBeVisible();
  await expect.poll(() => page.locator(".test-palette-scroll").evaluate((rail) => rail.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await expect(palette.getByRole("button", { name: "Next question" })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  if (capture) await page.screenshot({ path: join(capture, "practice-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await palette.getByRole("link", { name: /Question 1, answered/ }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 50" })).toBeVisible();
  await page.reload();
  await expect(page.locator('button[name="option"][value="a"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Maximize test" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("heading", { name: "Test ended" })).toBeVisible();
  await expect(page.locator(".sidebar")).toBeHidden();
  const resultsUrl = page.url();
  expect(new URL((await page.request.get(`${resultsUrl}?q=50`)).url()).pathname).toBe("/practice");
  await page.goBack();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.getByRole("button", { name: "Start test" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(resultsUrl);
  await expect(page.getByRole("heading", { name: "Test ended" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Final test score" })).toContainText("-0.67 / 100");
  await expect(page.getByRole("table", { name: "Performance by topic" })).toBeVisible();
  await expect(page.locator(".option-correct")).toHaveCount(0);
  if (capture) await page.screenshot({ path: join(capture, "test-ended.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole("link", { name: "Review answers" })).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "test-ended-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Review answers" }).click();
  await expect(page.getByRole("heading", { name: "Test review" })).toBeVisible();
  await expect(page.getByText(/100 points.*1 incorrect.*49 unanswered/)).toBeVisible();
  await expect(page.locator(".option-correct")).toContainText("Article 2");
  const answers = page.getByRole("table", { name: "All test answers" });
  await expect(answers.getByRole("row")).toHaveCount(51);
  await expect(answers.getByRole("row").nth(1)).toContainText(/A\. Article 1.*B\. Article 2.*Incorrect/);
  const reviewUrl = page.url();
  await page.getByRole("link", { name: "Exit test" }).click();
  const scores = page.getByRole("table", { name: "Recent test scores" });
  await expect(scores.getByRole("row").nth(1)).toContainText(/Polity PT-01.*-0\.67.*100.*49.*0%/);
  await page.goBack();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(scores).toBeVisible();
  await page.getByRole("button", { name: "Toggle black and white theme" }).click();
  if (capture) await page.screenshot({ path: join(capture, "recent-test-scores.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await scores.getByRole("button", { name: "Delete review" }).click();
  const deleteReview = page.getByRole("alertdialog", { name: "Delete this test review?" });
  await expect(deleteReview.getByRole("button", { name: "Cancel" })).toBeFocused();
  await deleteReview.getByRole("button", { name: "Cancel" }).click();
  await expect(scores).toBeVisible();
  await scores.getByRole("button", { name: "Delete review" }).click();
  await deleteReview.getByRole("button", { name: "Delete review" }).click();
  await expect(page.getByText("Finished tests will appear here.")).toBeVisible();
  await expect(page.getByText("Test review deleted.")).toBeVisible();
  expect((await page.request.get(reviewUrl)).status()).toBe(404);
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("table", { name: "Recent attempts" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Performance by topic" })).toContainText("Polity");
  await expect(page.getByRole("row").filter({ hasText: "Question 1" }).filter({ hasText: "Practice" })).toContainText(/Practice.*Incorrect/);
  if (capture) await page.screenshot({ path: join(capture, "practice-history.png") });
  await page.getByRole("link", { name: "Revision", exact: true }).click();
  await page.getByRole("link", { name: "Retry question 1", exact: true }).click();
  await page.locator('input[value="b"]').check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Correct answer" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Revision" }).click();
  await expect(page.getByRole("link", { name: "Retry question 1", exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/questions?format=table");
  await expect(page.getByRole("table").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  if (capture) await page.screenshot({ path: join(capture, "questions-mobile.png") });
});

test("uploads scanned PDFs and stages their editable table behind OCR review", async ({ page }) => {
  test.skip(!scanFixture, "Set SCAN_FIXTURE_DIR to the raster-only paper and key directory.");
  await page.goto("/admin/imports");
  await expect(page.getByRole("heading", { name: "Import history" })).toBeVisible();
  const title = "Scanned table sample";
  const existing = page.locator(".import-row").filter({ has: page.getByText(title, { exact: true }) });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await page.getByRole("link", { name: "New import" }).click();
    await page.getByLabel("Paper title").fill(title);
    await page.getByLabel("Subject").fill("Civics");
    await page.getByLabel("Questions PDF").setInputFiles(join(scanFixture!, "scanned-paper.pdf"));
    await page.getByLabel("Answers PDF").setInputFiles(join(scanFixture!, "scanned-answer-key.pdf"));
    await page.getByRole("button", { name: "Upload and process" }).click();
  }
  await expect(page.getByText("1 structured table")).toBeVisible({ timeout: 35_000 });
  await expect(page.getByText(/0 ready to publish · 1 flagged/)).toBeVisible();
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page.getByText(/Question text was read using OCR/)).toBeVisible();
  await expect(page.getByText(/answer key was read using OCR/)).toBeVisible();
  const table = page.getByRole("table", { name: "Question table from page 1" });
  await expect(table.getByRole("cell", { name: "Makes laws" })).toBeVisible();
  await expect(table.getByRole("cell", { name: "Interpret laws" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open answers PDF" })).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "ocr-review.png") });

  await page.getByRole("link", { name: "Edit", exact: true }).click();
  const cell = page.getByLabel("Table row 1, column 2");
  await expect(cell).toHaveValue("Makes laws");
  await cell.fill("Makes laws for review");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.reload();
  await expect(cell).toHaveValue("Makes laws for review");
  await cell.fill("Makes laws");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await expect(page.getByText(/0 ready to publish · 1 flagged/)).toBeVisible();
});

test("stages all rasterized Polity questions and tables for source review", async ({ page }) => {
  const rasterFixture = process.env.POLITY_RASTER_FIXTURE_DIR;
  const detailedFixtureDir = process.env.POLITY_FIXTURE_DIR;
  test.skip(!rasterFixture || !detailedFixtureDir, "Set POLITY_RASTER_FIXTURE_DIR and POLITY_FIXTURE_DIR to the sample PDF directories.");
  await page.goto("/admin/imports");
  await expect(page.getByRole("heading", { name: "Import history" })).toBeVisible();
  const scannedDetails = process.env.POLITY_DETAILED_RASTER_FIXTURE;
  const title = scannedDetails ? `Polity PT-01 · Fully scanned ${Date.now()}` : "Polity PT-01 · OCR review";
  if (scannedDetails) test.setTimeout(240_000);
  const existing = page.locator(".import-row").filter({ has: page.getByText(title, { exact: true }) });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await page.getByRole("link", { name: "New import" }).click();
    await page.getByLabel("Paper title").fill(title);
    await page.getByLabel("Subject").fill("Polity");
    await page.getByLabel("Questions PDF").setInputFiles(join(rasterFixture!, "polity-raster.pdf"));
    await page.getByLabel("Answers PDF").setInputFiles(scannedDetails ?? join(detailedFixtureDir!, polityDetailedPaper));
    await page.getByRole("button", { name: "Upload and process" }).click();
  }
  await expect(page.getByText("9 structured tables")).toBeVisible({ timeout: scannedDetails ? 205_000 : 55_000 });
  await expect(page.getByText("50 extracted · 0 ready to publish · 50 flagged · 0 published")).toBeVisible();
  await expect(page.getByText("OCR verification required", { exact: true })).toBeVisible();
  if (scannedDetails) {
    const exportPath = await page.getByRole("link", { name: "Export JSON" }).getAttribute("href");
    const response = await page.request.get(exportPath!);
    expect(response.ok()).toBe(true);
    const rows = await response.json() as { content: { answer: string | null } }[];
    expect(rows).toHaveLength(50);
    expect(rows.map(({ content }) => content.answer ?? "?").join("")).toBe(
      "BDDCA ADAAB BBCDB AADDA DBADC BDADB ACBCB CABAA BBDCA ACCAA".replaceAll(" ", "").toLowerCase(),
    );
  }
  await page.getByRole("link", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish 0 questions" })).toBeDisabled();
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await page.getByRole("link", { name: "Question 6, flagged", exact: true }).click();
  await expect(page.getByRole("table", { name: "Question table from page 3" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "House Committee", exact: true })).toBeVisible();
  await expect(page.getByText(/Question text was read using OCR/)).toBeVisible();
  await expect(page.getByRole("img", { name: /Original detailed explanation/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  if (capture) await page.screenshot({ path: join(capture, "polity-ocr-review.png") });
  if (scannedDetails) {
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Correct answer", exact: true })).toHaveValue("a");
    await page.getByRole("checkbox", { name: /verified this draft/ }).check();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    await page.getByRole("link", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Publish question 6" }).click();
    await expect(page.getByText("1 question published to the student bank.")).toBeVisible();
    await page.goto(`/questions?${new URLSearchParams({ source: title })}`);
    await expect(page.getByRole("link", { name: "Question 6", exact: true })).toBeVisible();
  }
});
