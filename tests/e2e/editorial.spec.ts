import { expect, test } from "@playwright/test";
import { join } from "node:path";

test("publishes revisions independently of active tests and keeps editorial history", async ({ page, context }) => {
  const fixture = process.env.SCAN_FIXTURE_DIR;
  test.skip(!fixture || process.env.EDITORIAL_TEST_DATABASE !== "1", "Use a dedicated editorial test database.");
  const title = `Editorial verification ${Date.now()}`;
  const admin = await context.newPage();
  await admin.goto("/admin/imports/new");
  await admin.getByLabel("Paper title").fill(title);
  await admin.getByLabel("Subject").fill("Civics");
  await admin.getByLabel("Question paper PDF").setInputFiles(join(fixture!, "scanned-paper.pdf"));
  await admin.getByLabel("Answer key PDF").setInputFiles(join(fixture!, "scanned-answer-key.pdf"));
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
  await admin.getByLabel("Explanation").fill("Editorial review verification.");
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

  await admin.goto(history);
  await expect(admin.getByRole("table", { name: "Published revisions" }).getByRole("row")).toHaveCount(3);
  await expect(admin.getByText("Published revision 2.")).toBeVisible();
  await admin.getByRole("button", { name: "Restore revision 1 to draft" }).click();
  await expect(admin.getByLabel("Correct answer")).toHaveValue("a");
  await bank.reload();
  await expect(bank.getByRole("radio").first()).toHaveValue("b");
  await admin.goto(history);
  await admin.getByRole("button", { name: "Archive question" }).click();
  await expect(admin.getByRole("button", { name: "Return to question bank" })).toBeVisible();
  await expect((await bank.goto(`/questions/${slug}`))?.status()).toBe(404);
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
  await page.getByLabel("Question paper PDF").setInputFiles(join(fixture!, "Test-01-Polity-01-QP-23-Nov-.pdf"));
  await page.getByLabel("Answer key PDF").setInputFiles(join(fixture!, "Test-01-Polity-01-Answer-Key-23-Nov-.pdf"));
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
  await page.getByLabel("Question paper PDF").setInputFiles(malformed);
  await page.getByLabel("Answer key PDF").setInputFiles(malformed);
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
  await admin.getByLabel("Question paper PDF").setInputFiles(join(fixture!, "scanned-paper.pdf"));
  await admin.getByLabel("Answer key PDF").setInputFiles(multipleKey ?? join(fixture!, "scanned-answer-key.pdf"));
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
  await page.getByLabel("Question paper PDF").setInputFiles(join(fixture!, "true-false-paper.pdf"));
  await page.getByLabel("Answer key PDF").setInputFiles(join(fixture!, "true-false-key.pdf"));
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
