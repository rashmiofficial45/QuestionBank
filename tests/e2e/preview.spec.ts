import { expect, test } from "@playwright/test";
import { join } from "node:path";

const sources = process.env.POLITY_FIXTURE_DIR;
const title = process.env.POLITY_IMPORT_TITLE ?? "Polity PT-01";
const capture = process.env.PREVIEW_SCREENSHOT_DIR;

test("Polity PDFs can be reviewed and published, then searched and practiced", async ({ page, request }) => {
  test.skip(!sources, "Set POLITY_FIXTURE_DIR to the supplied PDF directory.");
  await page.goto("/admin/imports");
  await expect(page.getByRole("heading", { name: "Import history" })).toBeVisible();
  const existing = page.locator(".import-row").filter({ has: page.getByText(title, { exact: true }) }).first();
  if (await existing.isVisible()) {
    await existing.click();
  } else {
    await page.getByRole("link", { name: "New import" }).click();
    await page.getByLabel("Paper title").fill(title);
    await page.getByLabel("Subject").fill("Polity");
    await page.getByLabel("Question paper PDF").setInputFiles(join(sources!, "Test-01-Polity-01-QP-23-Nov-.pdf"));
    await page.getByLabel("Answer key PDF").setInputFiles(join(sources!, "Test-01-Polity-01-Answer-Key-23-Nov-.pdf"));
    await page.getByRole("button", { name: "Upload and process" }).click();
  }

  await expect(page.getByRole("heading", { name: "Import results" })).toBeVisible({ timeout: 35_000 });
  await expect(page.getByText(/50 extracted/)).toBeVisible();
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await page.getByRole("link", { name: "Question 6", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Question 6", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /original prompt layout for question 6/i })).toBeVisible();
  const crop = page.getByRole("img", { name: /original prompt layout for question 6/i });
  await expect.poll(() => crop.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(200);
  const source = await page.getByRole("link", { name: "Open PDF" }).getAttribute("href");
  expect((await request.get(source!)).headers()["content-type"]).toBe("application/pdf");
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);

  const freshImport = await page.getByText(/50 ready to publish/).isVisible();
  if (freshImport) {
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit draft questions" })).toBeVisible();
    await page.getByRole("link", { name: "Question 1", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Question 1", exact: true })).toBeVisible();
    const originalText = await page.getByLabel("Question text").inputValue();
    const originalOption = await page.getByLabel("Option D").inputValue();
    const edit = page.getByLabel("Option D");
    await edit.fill(originalOption + " (temporary edit)");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Option D")).toHaveValue(originalOption + " (temporary edit)");
    await expect(page.getByLabel("Question text")).toHaveValue(originalText);
    await page.getByLabel("Option D").fill(originalOption);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();

    await page.getByRole("link", { name: "Publish", exact: true }).click();
    await page.getByRole("button", { name: "Publish 50 questions" }).click();
    await expect(page.getByText("50 questions published to the student bank.")).toBeVisible();
  }
  await expect(page.getByText(/50 published/)).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "mvp-import.png"), fullPage: true });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /your study workspace/i })).toBeVisible();
  if (capture) await page.screenshot({ path: join(capture, "mvp-desktop.png"), fullPage: true });
  await page.getByRole("textbox", { name: "Search questions" }).fill("Andaman Sea");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("link", { name: /In the Andaman Sea/ }).first().click();
  await expect(page.getByText("Correct answer", { exact: true })).toHaveCount(0);
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Correct answer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bookmark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bookmarked" })).toBeVisible();
  await page.getByRole("link", { name: "Bookmarks", exact: true }).click();
  await expect(page.getByRole("link", { name: /In the Andaman Sea/ })).toBeVisible();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page.getByText("1 of 1 attempts were correct.")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Start practice" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  if (capture) await page.screenshot({ path: join(capture, "mvp-mobile.png"), fullPage: true });
});
