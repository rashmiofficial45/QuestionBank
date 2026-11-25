import { expect, test } from "@playwright/test";
import { join } from "node:path";

const capture = process.env.PREVIEW_SCREENSHOT_DIR;
const scanFixture = process.env.SCAN_FIXTURE_DIR;

test("renders interactive cards in both themes, including structured tables and practice history", async ({ page }) => {
  await page.goto("/questions");
  await expect(page.getByRole("heading", { name: "Question bank" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bookmark question 1" })).toBeVisible();
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
  const palette = page.getByRole("navigation", { name: "Jump to a test question" });
  await expect(palette.getByRole("link")).toHaveCount(50);
  await page.locator('button[name="option"][value="a"]').click();
  await expect(palette.getByRole("link", { name: "Question 1, answered", exact: true })).toBeVisible();
  await expect(page.getByText("Incorrect answer", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mark for review" }).click();
  await expect(palette.getByRole("link", { name: "Question 1, answered, marked for review" })).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "practice-test.png") });
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Question 2 of 50" })).toBeVisible();
  await palette.getByRole("link", { name: "Question 50, unanswered" }).click();
  await expect(page.getByRole("heading", { name: "Question 50 of 50" })).toBeVisible();
  await expect.poll(() => page.locator(".test-palette-scroll").evaluate((rail) => rail.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  if (capture) await page.screenshot({ path: join(capture, "practice-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await palette.getByRole("link", { name: /Question 1, answered/ }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 50" })).toBeVisible();
  await page.reload();
  await expect(page.locator('button[name="option"][value="a"]')).toHaveAttribute("aria-pressed", "true");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("heading", { name: "Test review" })).toBeVisible();
  await expect(page.getByText(/100 points.*1 incorrect.*49 unanswered/)).toBeVisible();
  await expect(page.locator(".option-correct")).toContainText("Article 2");
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByRole("table", { name: "Recent attempts" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Question 1" }).filter({ hasText: "Practice" })).toContainText(/Practice.*Incorrect/);
  if (capture) await page.screenshot({ path: join(capture, "practice-history.png") });

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
    await page.getByLabel("Question paper PDF").setInputFiles(join(scanFixture!, "scanned-paper.pdf"));
    await page.getByLabel("Answer key PDF").setInputFiles(join(scanFixture!, "scanned-answer-key.pdf"));
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
  await expect(page.getByRole("link", { name: "Open answer key" })).toBeVisible();
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
  test.skip(!rasterFixture, "Set POLITY_RASTER_FIXTURE_DIR to the raster-only Polity fixture directory.");
  await page.goto("/admin/imports");
  await expect(page.getByRole("heading", { name: "Import history" })).toBeVisible();
  const title = "Polity PT-01 · OCR review";
  const existing = page.locator(".import-row").filter({ has: page.getByText(title, { exact: true }) });
  if (await existing.count()) {
    await existing.first().click();
  } else {
    await page.getByRole("link", { name: "New import" }).click();
    await page.getByLabel("Paper title").fill(title);
    await page.getByLabel("Subject").fill("Polity");
    await page.getByLabel("Question paper PDF").setInputFiles(join(rasterFixture!, "polity-raster.pdf"));
    await page.getByLabel("Answer key PDF").setInputFiles(join(rasterFixture!, "polity-key-raster.pdf"));
    await page.getByRole("button", { name: "Upload and process" }).click();
  }
  await expect(page.getByText("9 structured tables")).toBeVisible({ timeout: 55_000 });
  await expect(page.getByText("50 extracted · 0 ready to publish · 50 flagged · 0 published")).toBeVisible();
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await page.getByRole("link", { name: "Question 6, flagged", exact: true }).click();
  await expect(page.getByRole("table", { name: "Question table from page 3" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "House Committee", exact: true })).toBeVisible();
  await expect(page.getByText(/Question text was read using OCR/)).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "polity-ocr-review.png") });
});
