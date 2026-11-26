import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { detailedFixture, polityDetailedPaper } from "./detailed-fixture";
import { checkAccessibility } from "./verify-accessibility";

test("stages a question paper with a combined detailed answer PDF", async ({ page }) => {
  const fixture = process.env.RICH_OPTIONS_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use the dedicated editorial database and combined PDF fixture.");
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(`Combined PDF verification ${Date.now()}`);
  await page.getByLabel("Subject").fill("General");
  await page.getByLabel("Questions PDF").setInputFiles(join(fixture!, "combined.pdf"));
  await page.getByLabel("Answers PDF").setInputFiles(detailedFixture("A"));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/1 extracted.*1 flagged/)).toBeVisible({ timeout: 35_000 });
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page.getByText("Detailed explanation", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open answer key" })).toHaveCount(0);
  await expect(page.getByLabel("Correct answer")).toBeVisible();
});

test("publishes rich choices and reveals the imported explanation after answering", async ({ page }) => {
  const fixture = process.env.RICH_OPTIONS_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use the dedicated editorial database and rich-option PDFs.");
  const title = `Rich option verification ${Date.now()}`;
  const explanation = "A circle has a curved boundary.";
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(title);
  await page.getByLabel("Subject").fill("General");
  await page.getByLabel("Questions PDF").setInputFiles(join(fixture!, "paper.pdf"));
  await page.getByLabel("Answers PDF").setInputFiles(detailedFixture("A"));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/1 extracted.*1 flagged/)).toBeVisible({ timeout: 35_000 });
  const imported = page.url();
  await page.goto(`${imported}?mode=review&q=1`);
  const source = page.getByRole("img", { name: /source image 1 for option 1/i });
  await expect(source).toBeVisible();
  const image = new URL(await source.getAttribute("src") ?? "", page.url());
  expect((await page.request.get(image.toString())).ok()).toBe(true);
  image.search = "";
  expect((await page.request.get(image.toString())).status()).toBe(404);
  await expect(page.getByRole("link", { name: "Open answers PDF" })).toBeVisible();
  await page.goto(`${imported}?mode=edit&q=1`);
  await page.getByRole("textbox", { name: "Explanation" }).fill(explanation);
  await page.getByRole("textbox", { name: "Option B", exact: true }).fill("x^2");
  await page.getByRole("checkbox", { name: "Render option B as LaTeX" }).check();
  await page.getByRole("checkbox", { name: /verified this draft/ }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.goto(`${imported}?mode=publish`);
  await page.getByRole("button", { name: "Publish 1 question" }).click();
  await expect(page.getByText("1 question published to the student bank.")).toBeVisible();
  await page.goto(`/questions?${new URLSearchParams({ source: title })}`);
  await expect(page.locator("math")).toBeVisible();
  await expect.poll(() => source.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText(explanation)).toHaveCount(0);
  await page.getByRole("button", { name: /A. Circle diagram/ }).click();
  await expect(page.getByText("Correct answer", { exact: true })).toBeVisible();
  await expect(page.getByText(explanation)).toBeVisible();
  if (process.env.PREVIEW_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.PREVIEW_SCREENSHOT_DIR, "rich-choices.png") });
  await page.goto("/practice");
  await page.getByRole("combobox", { name: "Paper" }).selectOption(title);
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(page.locator("math")).toBeVisible();
  await expect(source).toBeVisible();
  await expect(page.getByText(explanation)).toHaveCount(0);
  await page.getByRole("button", { name: /A. Circle diagram/ }).click();
  await expect(page.getByText("Answer saved")).toBeVisible();
});

test("publishes revisions independently of active tests and keeps editorial history", async ({ page, context }) => {
  const fixture = process.env.SCAN_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database.");
  const title = `Editorial verification ${Date.now()}`;
  const admin = await context.newPage();
  await admin.goto("/admin/imports/new");
  await admin.getByLabel("Paper title").fill(title);
  await admin.getByLabel("Subject").fill("Civics");
  await admin.getByLabel("Questions PDF").setInputFiles(join(fixture!, "scanned-paper.pdf"));
  await admin.getByLabel("Answers PDF").setInputFiles(join(fixture!, "scanned-answer-key.pdf"));
  await admin.getByRole("button", { name: "Upload and process" }).click();
  await expect(admin.getByText("1 structured table")).toBeVisible({ timeout: 35_000 });
  const imported = admin.url();
  const edit = `${imported}?mode=edit&q=1`;
  const publish = `${imported}?mode=publish&q=1`;
  const history = `${imported}?mode=history&q=1`;
  const slug = imported.split("/").at(-1) + "-1";

  await admin.goto(edit);
  await admin.getByLabel("Topic").fill("Public institutions");
  await admin.getByLabel("Tags").fill("legislature, duties");
  await admin.getByRole("checkbox", { name: /verified this draft/ }).check();
  await admin.getByRole("button", { name: "Save draft" }).click();
  await expect(admin.getByText("Draft saved.")).toBeVisible();
  await admin.goto(publish);
  await admin.getByRole("button", { name: "Publish question 1" }).click();
  await expect(admin.getByText("1 question published to the student bank.")).toBeVisible();
  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Practice test" })).toBeVisible();
  await page.getByLabel("Paper", { exact: true }).selectOption(title, { timeout: 5000 });
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 1" })).toBeVisible();
  await page.locator('button[name="option"][value="a"]').click();
  await expect(page.getByText("Answer saved", { exact: true })).toBeVisible();

  await admin.goto(edit);
  await admin.getByRole("button", { name: "Move option B up" }).click();
  await admin.getByLabel("Correct answer").selectOption("b");
  await admin.getByRole("textbox", { name: "Explanation" }).fill("Editorial review verification.");
  await admin.getByRole("button", { name: "Save draft" }).click();
  await expect(admin.getByText("Draft saved.")).toBeVisible();
  const bank = await context.newPage();
  await bank.goto(`/questions/${slug}`);
  await expect(bank.getByRole("radio").first()).toHaveValue("a");
  await admin.goto(publish);
  await admin.getByRole("button", { name: "Publish question 1" }).click();
  await expect(admin.getByText("1 question published to the student bank.")).toBeVisible();
  await bank.getByRole("radio").first().check();
  await bank.getByRole("button", { name: "Check answer" }).click();
  await expect(bank.locator(".answer-form").getByRole("alert")).toContainText("Correct answer");
  await bank.reload();
  await expect(bank.getByRole("radio").first()).toHaveValue("b");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("heading", { name: "Test ended" })).toBeVisible();
  await page.getByRole("link", { name: "Review answers" }).click();
  await expect(page.getByText(/2 \/ 2 points.*1 correct/)).toBeVisible();
  await expect(page.locator(".option-correct")).toContainText("Parliament");
  const retainedCrop = await page.locator(".question-content img").first().getAttribute("src");
  expect(retainedCrop).toBeTruthy();

  await admin.goto(history);
  await expect(admin.getByRole("table", { name: "Published revisions" }).getByRole("row")).toHaveCount(3);
  await expect(admin.getByText("Published revision 2.")).toBeVisible();
  await admin.getByRole("button", { name: "Restore revision 1 to draft" }).click();
  await expect(admin.getByLabel("Correct answer")).toHaveValue("a");
  await bank.reload();
  await expect(bank.getByRole("radio").first()).toHaveValue("b");
  const publicCrop = await bank.locator('.question-content img').first().getAttribute("src");
  expect(publicCrop).toBeTruthy();
  expect((await bank.request.get(publicCrop!)).status()).toBe(200);
  await admin.goto(history);
  await admin.getByRole("button", { name: "Archive question" }).click();
  await expect(admin.getByRole("button", { name: "Return to question bank" })).toBeVisible();
  await expect((await bank.goto(`/questions/${slug}`))?.status()).toBe(404);
  expect((await bank.request.get(publicCrop!)).status()).toBe(404);
  expect((await page.request.get(retainedCrop!)).status()).toBe(200);
  const stranger = await context.browser()!.newContext();
  try {
    expect((await stranger.request.get(new URL(retainedCrop!, page.url()).toString())).status()).toBe(404);
  } finally {
    await stranger.close();
  }
  await admin.getByRole("button", { name: "Return to question bank" }).click();
  await expect(admin.getByRole("button", { name: "Archive question" })).toBeVisible();
  await bank.goto(`/questions/${slug}`);
  await expect(bank.getByRole("radio").first()).toHaveValue("b");
});

test("publishes only the selected questions from a validated import", async ({ page }) => {
  const fixture = process.env.POLITY_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database with the Polity fixtures.");
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(`Bulk publish verification ${Date.now()}`);
  await page.getByLabel("Subject").fill("Polity");
  await page.getByLabel("Questions PDF").setInputFiles(join(fixture!, "Test-01-Polity-01-QP-23-Nov-.pdf"));
  await page.getByLabel("Answers PDF").setInputFiles(join(fixture!, polityDetailedPaper));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/50 ready to publish/)).toBeVisible({ timeout: 35_000 });
  const id = page.url().split("/").at(-1);
  await page.getByRole("link", { name: "Publish", exact: true }).click();
  await page.getByRole("checkbox", { name: "Question 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Question 6", exact: true }).check();
  await page.getByRole("button", { name: "Publish selected" }).click();
  await expect(page.getByText("2 questions published to the student bank.")).toBeVisible();
  await expect(page.getByText(/48 ready to publish.*2 published/)).toBeVisible();
  expect((await page.goto(`/questions/${id}-2`))?.status()).toBe(404);
  await page.goto(`/questions/${id}-6`);
  await expect(page.getByRole("table")).toBeVisible();
});

test("requeues a failed import and records the retry", async ({ page }) => {
  test.skip(process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database.");
  const malformed = { name: "malformed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nINVALID") };
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(`Import retry verification ${Date.now()}`);
  await page.getByLabel("Subject").fill("Civics");
  await page.getByLabel("Questions PDF").setInputFiles(malformed);
  await page.getByLabel("Answers PDF").setInputFiles(malformed);
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByRole("button", { name: "Retry import" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Retry import" }).click();
  await page.getByRole("link", { name: "View editorial activity" }).click();
  await expect(page.getByRole("table", { name: "Editorial activity" })).toContainText("Retry queued");
});

test("publishes and grades a multiple-answer question in the bank and a timed test", async ({ page, context }) => {
  const fixture = process.env.SCAN_FIXTURE_DIR;
  const multipleKey = process.env.MULTIPLE_ANSWER_KEY_FIXTURE;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database.");
  const title = `Multiple-answer verification ${Date.now()}`;
  const admin = await context.newPage();
  await admin.goto("/admin/imports/new");
  await admin.getByLabel("Paper title").fill(title);
  await admin.getByLabel("Subject").fill("Civics");
  await admin.getByLabel("Questions PDF").setInputFiles(join(fixture!, "scanned-paper.pdf"));
  await admin.getByLabel("Answers PDF").setInputFiles(multipleKey ?? join(fixture!, "scanned-answer-key.pdf"));
  await admin.getByRole("button", { name: "Upload and process" }).click();
  await expect(admin.getByText("1 structured table")).toBeVisible({ timeout: 35_000 });
  const imported = admin.url();
  if (multipleKey) {
    await admin.goto(`${imported}?mode=review&q=1`);
    await expect(admin.getByText(/The key lists multiple correct options/)).toBeVisible();
    await expect(admin.locator(".review-option.correct")).toHaveCount(2);
    const capture = process.env.PREVIEW_SCREENSHOT_DIR;
    if (capture) await admin.screenshot({ path: join(capture, "multiple-answer-import.png") });
  }
  await admin.goto(`${imported}?mode=edit&q=1`);
  if (multipleKey) {
    await expect(admin.getByLabel("Answer interaction")).toHaveValue("multiple_choice");
    await expect(admin.getByRole("checkbox", { name: "Option A", exact: true })).toBeChecked();
    await expect(admin.getByRole("checkbox", { name: "Option B", exact: true })).toBeChecked();
  } else {
    await admin.getByLabel("Answer interaction").selectOption("multiple_choice");
    await admin.getByRole("checkbox", { name: "Option B", exact: true }).check();
  }
  await admin.getByRole("checkbox", { name: /verified this draft/ }).check();
  await admin.getByRole("button", { name: "Save draft" }).click();
  await expect(admin.getByText("Draft saved.")).toBeVisible();
  await admin.goto(`${imported}?mode=publish&q=1`);
  await admin.getByRole("button", { name: "Publish question 1" }).click();
  await expect(admin.getByText("1 question published to the student bank.")).toBeVisible();

  await page.goto(`/questions?${new URLSearchParams({ format: "multiple_choice", source: title })}`);
  const card = page.getByRole("article").filter({ hasText: title });
  await expect(card.getByRole("checkbox")).toHaveCount(2);
  await card.locator('input[value="a"]').check();
  await card.getByRole("button", { name: "Check answer" }).click();
  await expect(card.getByRole("alert")).toContainText("Incorrect answer");
  await expect(card.locator(".option-correct")).toHaveCount(2);

  await page.goto("/practice");
  await page.getByLabel("Paper", { exact: true }).selectOption(title);
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 1" })).toBeVisible();
  const testA = page.locator('.test-options input[value="a"]');
  const testB = page.locator('.test-options input[value="b"]');
  await page.keyboard.press("ArrowDown");
  await expect(testA).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(testA).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(testB).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(testB).toBeChecked();
  await expect(page.getByText("Answer saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(testA).toBeChecked();
  await expect(testB).toBeChecked();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("region", { name: "Final test score" })).toContainText("2 / 2");
  await page.getByRole("link", { name: "Review answers" }).click();
  await expect(page.locator(".option-correct")).toHaveCount(2);
  await expect(page.getByRole("table", { name: "All test answers" }).getByRole("row").nth(1)).toContainText("Correct");
  const capture = process.env.PREVIEW_SCREENSHOT_DIR;
  if (capture) await page.screenshot({ path: join(capture, "multiple-answer-review.png") });
});

test("imports, publishes, and grades True/False questions", async ({ page }) => {
  const fixture = process.env.TRUE_FALSE_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database and the True/False fixtures.");

  const title = `True and False sample ${Date.now()}`;
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(title);
  await page.getByLabel("Subject").fill("General");
  await page.getByLabel("Questions PDF").setInputFiles(join(fixture!, "true-false-paper.pdf"));
  await page.getByLabel("Answers PDF").setInputFiles(join(fixture!, "true-false-key.pdf"));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/2 extracted.*2 flagged/)).toBeVisible({ timeout: 35_000 });
  const imported = page.url();

  for (const number of [1, 2]) {
    await page.goto(`${imported}?mode=edit&q=${number}`);
    await expect(page.getByLabel("Answer interaction")).toHaveValue("true_false");
    await expect(page.getByLabel("Correct answer")).toHaveValue(number === 1 ? "b" : "a");
    await page.getByRole("checkbox", { name: /verified this draft/ }).check();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
  }
  await page.goto(`${imported}?mode=publish`);
  await page.getByRole("button", { name: "Publish 2 questions" }).click();
  await expect(page.getByText("2 questions published to the student bank.")).toBeVisible();

  await page.goto(`/questions?${new URLSearchParams({ format: "true_false", source: title })}`);
  const first = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Question 1", exact: true }) });
  await first.getByRole("button", { name: "B. True", exact: true }).click();
  await expect(first.getByRole("alert")).toContainText("Correct answer");

  await page.goto("/practice");
  await page.getByLabel("Paper", { exact: true }).selectOption(title);
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 2" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Select True or False" })).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("button", { name: "B. True", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Answer saved", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Jump to a test question" }).getByRole("link", { name: "Next question" }).click();
  await expect(page.getByRole("heading", { name: "Question 2 of 2" })).toBeVisible();
  await page.getByRole("button", { name: "B. True", exact: true }).click();
  await expect(page.getByText("Answer saved", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("region", { name: "Final test score" })).toContainText("1.33 / 4");
  await page.getByRole("link", { name: "Review answers" }).click();
  await page.getByRole("navigation", { name: "Jump to a test question" }).getByRole("link", { name: "Next question" }).click();
  await expect(page.locator(".option-correct")).toContainText("False");
  await expect(page.locator(".option-incorrect")).toContainText("True");
  const capture = process.env.PREVIEW_SCREENSHOT_DIR;
  if (capture) await page.screenshot({ path: join(capture, "true-false-review.png") });
});

test("imports statement blocks and keeps single-choice grading after editorial edits", async ({ page }) => {
  const fixture = process.env.STATEMENTS_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database and the statement fixtures.");

  const title = `Statement format sample ${Date.now()}`;
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(title);
  await page.getByLabel("Subject").fill("General");
  await page.getByLabel("Questions PDF").setInputFiles(join(fixture!, "statements-paper.pdf"));
  await page.getByLabel("Answers PDF").setInputFiles(detailedFixture("C"));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/1 extracted.*1 flagged/)).toBeVisible({ timeout: 35_000 });
  const imported = page.url();

  await page.goto(`${imported}?mode=review&q=1`);
  const list = page.getByRole("list", { name: "Statements" });
  await expect(list.getByRole("listitem").first()).toContainText("Statement I:");
  await expect(list.getByRole("listitem").nth(1)).toContainText("Statement II:");
  await page.goto(`${imported}?mode=edit&q=1`);
  await expect(page.getByLabel("Answer interaction")).toHaveValue("single_choice");
  await page.getByLabel("Statement II:", { exact: true }).fill("A leap year has 366 days.");
  await page.getByRole("checkbox", { name: /verified this draft/ }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.goto(`${imported}?mode=publish&q=1`);
  await page.getByRole("button", { name: "Publish question 1" }).click();
  await expect(page.getByText("1 question published to the student bank.")).toBeVisible();

  await page.goto(`/questions?${new URLSearchParams({ format: "statements", source: title, q: "366" })}`);
  await expect(list.locator("mark")).toHaveText("366");
  await page.goto("/practice");
  await page.getByLabel("Paper", { exact: true }).selectOption(title);
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText("Which of the statements are correct?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "A. Only statement I", exact: true }).click();
  await expect(page.getByText("Answer saved", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("region", { name: "Final test score" })).toContainText("-0.67 / 2");
  await page.getByRole("link", { name: "Review answers" }).click();
  await expect(page.locator(".option-correct")).toContainText("Both statements");
  const capture = process.env.PREVIEW_SCREENSHOT_DIR;
  if (capture) await page.screenshot({ path: join(capture, "statement-test-review.png") });
});

test("imports, edits, and grades an Assertion–Reason question", async ({ page }) => {
  const fixture = process.env.ASSERTION_REASON_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database and the Assertion–Reason fixtures.");

  const title = `Assertion and Reason sample ${Date.now()}`;
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(title);
  await page.getByLabel("Subject").fill("General");
  await page.getByLabel("Questions PDF").setInputFiles(join(fixture!, "assertion-reason-paper.pdf"));
  await page.getByLabel("Answers PDF").setInputFiles(detailedFixture("B"));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/1 extracted.*1 flagged/)).toBeVisible({ timeout: 35_000 });
  const imported = page.url();
  const pair = page.locator('dl[aria-label="Assertion and reason"]');

  await page.goto(`${imported}?mode=review&q=1`);
  await expect(pair.locator("dt")).toHaveText(["Assertion (A):", "Reason (R):"]);
  await expect(pair.locator("dd").nth(1)).toHaveText("A week contains seven days.");
  await page.goto(`${imported}?mode=edit&q=1`);
  await expect(page.getByLabel("Answer interaction")).toHaveValue("single_choice");
  await expect(page.getByRole("combobox", { name: "Correct answer", exact: true })).toHaveValue("b");
  await page.getByRole("textbox", { name: "Reason (R):", exact: true }).fill("A week has seven days.");
  await page.getByRole("checkbox", { name: /verified this draft/ }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.goto(`${imported}?mode=publish&q=1`);
  await page.getByRole("button", { name: "Publish question 1" }).click();
  await expect(page.getByText("1 question published to the student bank.")).toBeVisible();

  await page.goto(`/questions?${new URLSearchParams({ format: "assertion_reason", source: title, q: "seven" })}`);
  await expect(pair.locator("mark")).toHaveText("seven");
  await page.goto("/practice");
  await page.getByLabel("Paper", { exact: true }).selectOption(title);
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(pair).toBeVisible();
  await expect(page.getByText("Select the correct answer.", { exact: true })).toBeVisible();
  await page.locator('.test-options button[value="a"]').click();
  await expect(page.getByText("Answer saved", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("region", { name: "Final test score" })).toContainText("-0.67 / 2");
  await page.getByRole("link", { name: "Review answers" }).click();
  await expect(page.locator(".option-correct")).toContainText("R does not explain A");
  await expect(page.locator(".option-incorrect")).toContainText("R correctly explains A");
  if (process.env.ADVANCED_VISUAL === "1") {
    await page.evaluate(() => document.fonts.ready);
    await expect(pair).toHaveScreenshot("assertion-reason-desktop.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
    await page.getByRole("button", { name: "Toggle black and white theme" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(pair).toHaveScreenshot("assertion-reason-mobile-dark.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
    await checkAccessibility(page, "Assertion–Reason in Black");
  }
  const capture = process.env.PREVIEW_SCREENSHOT_DIR;
  if (capture) await page.screenshot({ path: join(capture, "assertion-reason-review.png") });
});

test("publishes written answers, grades decimals, and tracks study activity", async ({ page }) => {
  const fixture = process.env.WRITTEN_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database and written-answer fixtures.");
  const title = `Written answer verification ${Date.now()}`;
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(title);
  await page.getByLabel("Subject").fill("General");
  await page.getByLabel("Questions PDF").setInputFiles(join(fixture!, "written-paper.pdf"));
  await page.getByLabel("Answers PDF").setInputFiles(detailedFixture("B", "A"));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/2 extracted.*2 flagged/)).toBeVisible({ timeout: 35_000 });
  const imported = page.url();
  await page.goto(`${imported}?mode=edit&q=1`);
  await page.getByRole("combobox", { name: "Answer interaction" }).selectOption("numeric");
  await page.getByRole("textbox", { name: "Question text", exact: true }).fill("6 \\times 7");
  await page.getByRole("combobox", { name: "Text block style" }).selectOption("equation");
  await page.getByLabel("Reference answer").fill("42");
  await page.getByRole("checkbox", { name: /verified this draft/ }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();

  await page.goto(`${imported}?mode=edit&q=2`);
  await page.getByRole("combobox", { name: "Answer interaction" }).selectOption("descriptive");
  await page.getByLabel("Reference answer").fill("A reference answer for self-assessment.");
  await page.getByRole("checkbox", { name: /verified this draft/ }).check();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.goto(`${imported}?mode=publish`);
  await page.getByRole("button", { name: "Publish 2 questions" }).click();
  await expect(page.getByText("2 questions published to the student bank.")).toBeVisible();

  await page.goto(`/questions?${new URLSearchParams({ format: "descriptive", source: title })}`);
  await page.getByRole("link", { name: "Question 2", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Question 2" })).toBeVisible();
  await expect(page.getByText("A reference answer for self-assessment.")).toHaveCount(0);
  const written = page.getByRole("textbox", { name: "Your response", exact: true });
  await written.pressSequentially("My draft response.");
  await expect(written).toHaveValue("My draft response.");
  await page.getByRole("button", { name: "Reveal reference answer" }).click({ timeout: 5_000 });
  await expect(page.getByText("A reference answer for self-assessment.")).toBeVisible();
  await expect(written).toHaveValue("My draft response.");
  await page.getByText("Study note", { exact: true }).click();
  await page.getByRole("textbox", { name: "Study note" }).fill("Practice explaining the reasoning.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Note saved.")).toBeVisible();
  await page.reload();
  await page.getByText("Study note", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Study note" })).toHaveValue("Practice explaining the reasoning.");

  await page.goto("/practice");
  await page.getByLabel("Paper", { exact: true }).selectOption(title);
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 1" })).toBeVisible();
  await expect(page.locator("math")).toBeVisible();
  if (process.env.ADVANCED_VISUAL === "1") {
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".test-panel .question-content")).toHaveScreenshot("equation-desktop.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
    await checkAccessibility(page, "Numerical response");
  }
  await page.getByLabel("Your response").fill("042.00");
  await page.getByRole("button", { name: "Save response" }).click();
  await expect(page.getByText("Answer saved")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("region", { name: "Final test score" })).toContainText("2 / 2");
  await page.getByRole("link", { name: "Review answers" }).click();
  await expect(page.getByRole("table", { name: "All test answers" })).toContainText("042.00");
  const capture = process.env.PREVIEW_SCREENSHOT_DIR;
  if (capture) await page.screenshot({ path: join(capture, "written-test-review.png") });
  await page.goto("/progress");
  await expect(page.getByRole("img", { name: /daily study attempts/i })).toBeVisible();
  await page.getByText("Daily attempt counts", { exact: true }).click();
  await expect(page.getByRole("table", { name: "Daily attempt counts" })).toBeVisible();
  if (process.env.ADVANCED_VISUAL === "1") {
    await checkAccessibility(page, "Populated activity and progress");
    await page.getByRole("button", { name: "Toggle black and white theme" }).click();
    await checkAccessibility(page, "Populated activity and progress in Black");
  }
  if (capture) await page.screenshot({ path: join(capture, "study-analytics.png") });
});

test("grades matching pairs and chronological order", async ({ page }) => {
  const fixture = process.env.WRITTEN_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database and editable fixtures.");
  const title = `Structured answer verification ${Date.now()}`;
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(title);
  await page.getByLabel("Subject").fill("General");
  await page.getByLabel("Questions PDF").setInputFiles(join(fixture!, "written-paper.pdf"));
  await page.getByLabel("Answers PDF").setInputFiles(detailedFixture("B", "A"));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/2 extracted.*2 flagged/)).toBeVisible({ timeout: 35_000 });
  const imported = page.url();

  for (const [number, interaction] of [[1, "pair_matching"], [2, "ordering"]] as const) {
    await page.goto(`${imported}?mode=edit&q=${number}`);
    await page.getByRole("combobox", { name: "Answer interaction" }).selectOption(interaction);
    if (interaction === "pair_matching") {
      await page.getByLabel("Matching prompts").fill("First quantity\nSecond quantity");
    }
    await page.getByLabel("Correct sequence of option labels").fill("B, A");
    await page.getByRole("checkbox", { name: /verified this draft/ }).check();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
  }
  await page.goto(`${imported}?mode=publish`);
  await page.getByRole("button", { name: "Publish 2 questions" }).click();
  await expect(page.getByText("2 questions published to the student bank.")).toBeVisible();
  await page.goto("/practice");
  await page.getByLabel("Paper", { exact: true }).selectOption(title);
  await page.getByRole("button", { name: "Start test" }).click();
  await page.getByRole("combobox", { name: "First quantity" }).selectOption("b");
  await page.getByRole("combobox", { name: "Second quantity" }).selectOption("a");
  await page.getByRole("button", { name: "Save response" }).click();
  await expect(page.getByText("Answer saved")).toBeVisible();
  await page.getByRole("navigation", { name: "Jump to a test question" }).getByRole("link", { name: "Next question" }).click();
  await page.getByRole("combobox", { name: "Position 1" }).selectOption("a");
  await page.getByRole("combobox", { name: "Position 2" }).selectOption("b");
  await page.getByRole("button", { name: "Save response" }).click();
  await expect(page.getByText("Answer saved")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("region", { name: "Final test score" })).toContainText("1.33 / 4");
  await page.getByRole("link", { name: "Review answers" }).click();
  await expect(page.getByRole("table", { name: "All test answers" })).toContainText("First quantity");
  if (process.env.ADVANCED_VISUAL === "1") {
    await checkAccessibility(page, "Pair-matching review");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".test-options")).toHaveScreenshot("matching-desktop.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
  }
  const capture = process.env.PREVIEW_SCREENSHOT_DIR;
  if (capture) await page.screenshot({ path: join(capture, "matching-test-review.png") });
});
