import { expect, test } from "@playwright/test";
import { checkAccessibility } from "./verify-accessibility";

test.skip(process.env.EDITORIAL_TEST_DATABASE !== "1", "Use an isolated editorial database.");

test("creates, edits, autosaves locally, and publishes a manual question", async ({ page }) => {
  const title = `Manual question ${Date.now()}`;
  await page.goto("/admin/imports/data?mode=manual");
  await page.getByLabel("Source title").fill(title);
  await page.getByLabel("Subject").fill("Manual regression");
  await page.getByLabel("Question text").fill("Which number is even?");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByRole("heading", { name: "Edit draft questions" })).toBeVisible();
  await page.getByRole("button", { name: "Add option" }).click();
  await page.getByRole("textbox", { name: "Option A", exact: true }).fill("One");
  await page.getByRole("button", { name: "Add option" }).click();
  await page.getByRole("textbox", { name: "Option B", exact: true }).fill("Two");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Option B", exact: true })).toBeEmpty();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Option B", exact: true })).toHaveValue("Two");
  await page.getByLabel("Correct answer").selectOption({ label: "B" });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Option B", exact: true })).toHaveValue("Two");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
  await page.getByRole("link", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: "Publish 1 question" }).click();
  await expect(page.getByText("1 question published to the student bank.")).toBeVisible();
  await page.goto(`/questions?source=${encodeURIComponent(title)}`);
  await expect(page.getByText("Which number is even?")).toBeVisible();
});

test("imports and exports CSV and JSON and resolves cross-import duplicates", async ({ page, request }) => {
  const title = `Transfer source ${Date.now()}`;
  const text = `Which entry belongs to ${title}?`;
  await page.goto("/admin/imports/data");
  await page.getByLabel("Source title").fill(title);
  await page.getByLabel("Subject").fill("Transfer regression");
  await page.getByLabel("CSV or JSON file").setInputFiles({
    name: "questions.csv", mimeType: "text/csv",
    buffer: Buffer.from(`question,option_a,option_b,answer\r\n"${text}","First, choice","Second",a\r\n`),
  });
  await page.getByRole("button", { name: "Import drafts" }).click();
  await expect(page.getByText(/1 extracted.*1 ready to publish/)).toBeVisible();
  const csv = await request.get((await page.getByRole("link", { name: "Export CSV" }).getAttribute("href"))!);
  expect(await csv.text()).toContain("classification");
  const json = await request.get((await page.getByRole("link", { name: "Export JSON" }).getAttribute("href"))!);
  const rows = await json.json();
  expect(rows[0].content.options[0].text).toBe("First, choice");
  await page.goto("/admin/imports/data");
  await page.getByLabel("Source title").fill(title + " copy");
  await page.getByLabel("Subject").fill("Transfer regression");
  await page.getByLabel("CSV or JSON file").setInputFiles({
    name: "questions.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(rows)),
  });
  await page.getByRole("button", { name: "Import drafts" }).click();
  await expect(page.getByText(/1 extracted.*1 ready to publish/)).toBeVisible();
  await page.goto("/admin/duplicates");
  const group = page.locator("section").filter({ hasText: text });
  await expect(group.getByRole("link")).toHaveCount(2);
  await group.getByRole("button", { name: "Exclude duplicate" }).last().click();
  await expect(group).toHaveCount(0);
});

test("saves editorial settings and uses them as timed test defaults", async ({ page }) => {
  await page.goto("/admin/settings");
  await page.getByLabel("Duration (minutes)").fill("35");
  await page.getByRole("button", { name: "Save test defaults" }).click();
  await expect(page.getByText("Test defaults saved.")).toBeVisible();
  const subject = `Taxonomy ${Date.now()}`;
  await page.getByLabel("Name", { exact: true }).fill(subject);
  await page.getByRole("button", { name: "Add classification" }).click();
  await expect(page.locator(`input[value="${subject}"]`)).toBeVisible();
  await page.goto("/practice");
  await expect(page.getByLabel("Duration (minutes)")).toHaveValue("35");
});

test("checks, resumes and reviews untimed practice and manual revision", async ({ page }) => {
  await page.goto("/practice/drill");
  await page.getByLabel("Questions").fill("1");
  await page.getByRole("button", { name: "Start untimed practice" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 1" })).toBeVisible();
  await page.getByRole("button", { name: "Mark for revision" }).click();
  await expect(page.getByRole("button", { name: "Unmark for revision" })).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText(/^(Correct|Incorrect) answer$/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/^(Correct|Incorrect) answer$/)).toBeVisible();
  await page.getByRole("button", { name: "Finish practice" }).click();
  await expect(page.getByRole("heading", { name: "Practice complete" })).toBeVisible();
  await page.getByRole("link", { name: "Review answers" }).click();
  await expect(page.getByText(/^(Correct|Incorrect) answer$/)).toBeVisible();
  await page.goto("/questions?status=revision");
  await expect(page.getByText("1 question", { exact: true })).toBeVisible();
});

test("autosaves valid blocks to the server and restores original content", async ({ page }) => {
  await page.goto("/admin/imports/data?mode=manual");
  await page.getByLabel("Source title").fill(`Autosave regression ${Date.now()}`);
  await page.getByLabel("Subject").fill("Editorial workflow");
  await page.getByLabel("Question text").fill("Original question for the autosave check");
  await page.getByRole("button", { name: "Create draft" }).click();
  await page.getByRole("checkbox", { name: "Autosave valid drafts" }).check();
  await page.getByRole("textbox", { name: "Question text", exact: true }).fill("A new question copied to PostgreSQL by autosave");
  await expect(page.getByText("Draft saved.")).toBeVisible();
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page.getByText("A new question copied to PostgreSQL by autosave")).toBeVisible();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Restore original content to draft" }).click();
  await expect(page.getByRole("textbox", { name: "Question text", exact: true })).toHaveValue("Original question for the autosave check");
});

test("new settings and untimed practice work at phone width in Black and White", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Editorial settings" })).toBeVisible();
  await checkAccessibility(page, "Editorial settings in White");
  await page.getByRole("button", { name: "Toggle black and white theme" }).click();
  await checkAccessibility(page, "Editorial settings in Black");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.goto("/practice/drill");
  await expect(page.getByRole("button", { name: "Start untimed practice" })).toBeVisible();
  await checkAccessibility(page, "Untimed practice in Black");
  await page.getByRole("button", { name: "Toggle black and white theme" }).click();
  await checkAccessibility(page, "Untimed practice in White");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
