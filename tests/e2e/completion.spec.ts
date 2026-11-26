import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { detailedFixture } from "./detailed-fixture";
import { checkAccessibility } from "./verify-accessibility";

test.skip(process.env.EDITORIAL_TEST_DATABASE !== "1", "Use an isolated editorial database.");

test("can cancel deletion or delete an unpublished PDF import", async ({ page }) => {
  const fixtures = process.env.RICH_OPTIONS_FIXTURE_DIR;
  test.skip(!fixtures, "Set RICH_OPTIONS_FIXTURE_DIR to the PDF fixture directory.");
  const title = `Delete draft import ${Date.now()}`;
  await page.goto("/admin/imports/new");
  await page.getByLabel("Paper title").fill(title);
  await page.getByLabel("Subject").fill("General");
  await page.getByLabel("Question paper PDF").setInputFiles(join(fixtures!, "combined.pdf"));
  await page.getByLabel("Answer key with detailed explanations PDF").setInputFiles(detailedFixture("A"));
  await page.getByRole("button", { name: "Upload and process" }).click();
  await expect(page.getByText(/1 extracted/)).toBeVisible({ timeout: 35_000 });
  const importUrl = page.url();
  const id = new URL(importUrl).pathname.split("/").at(-1)!;
  const sourceUrl = `/api/v1/source/${id}/paper.pdf`;
  expect((await page.request.get(sourceUrl)).ok()).toBe(true);

  await page.getByRole("button", { name: "Delete import", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Delete this import?" });
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("button", { name: "Delete import", exact: true }).click();
  await confirmation.getByRole("button", { name: "Delete import", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Import history" })).toBeVisible();
  await expect(page.getByText("Import deleted.", { exact: true })).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  expect((await page.request.get(importUrl)).status()).toBe(404);
  expect((await page.request.get(sourceUrl)).status()).toBe(404);
});

test("study notes persist across revisits and remain private to the browser profile", async ({ page, browser }) => {
  await page.goto(`/questions?${new URLSearchParams({ source: process.env.POLITY_IMPORT_TITLE ?? "Polity PT-01" })}`);
  await page.getByRole("link", { name: "Question 1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Question 1", exact: true })).toBeVisible();
  const question = page.url();
  const note = page.getByRole("textbox", { name: "Study note", exact: true });
  const summary = page.getByText("Study note", { exact: true });
  const save = page.getByRole("button", { name: "Save note", exact: true });
  const reminder = "Read what the question asks.\nCross-check the exception before choosing.";
  await summary.click();
  await expect(save).toBeDisabled();
  await note.fill(reminder);
  await save.click();
  await expect(page.getByText("Note saved.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Skip to next question" }).click();
  await expect(page.getByRole("heading", { name: "Question 2", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.locator("summary").getByText(/Read what the question asks/)).toBeVisible();
  await page.reload();
  await summary.click();
  await expect(note).toHaveValue(reminder);

  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    await other.goto(question);
    await other.getByText("Study note", { exact: true }).click();
    await expect(other.getByRole("textbox", { name: "Study note", exact: true })).toBeEmpty();
  } finally {
    await otherContext.close();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle black and white theme" }).click();
  await checkAccessibility(page, "Open study note in Black at phone width");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await note.fill("Compare both statements carefully.");
  await save.click();
  await expect(page.getByText("Note saved.", { exact: true })).toBeVisible();
  await page.reload();
  await summary.click();
  await expect(note).toHaveValue("Compare both statements carefully.");
  await note.fill("");
  await save.click();
  await expect(page.getByText("Note removed.", { exact: true })).toBeVisible();
  await page.reload();
  await summary.click();
  await expect(note).toBeEmpty();
});

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
  await expect(page.getByRole("button", { name: "Delete import", exact: true })).toHaveCount(0);
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

test("keeping a duplicate group preserves its drafts and dismisses it from review", async ({ page }) => {
  const title = `Keep duplicate ${Date.now()}`;
  const question = `Which example belongs to ${title}?`;
  for (const suffix of ["one", "two"]) {
    await page.goto("/admin/imports/data");
    await page.getByLabel("Source title").fill(`${title} ${suffix}`);
    await page.getByLabel("Subject").fill("Duplicate regression");
    await page.getByLabel("CSV or JSON file").setInputFiles({
      name: "questions.csv", mimeType: "text/csv",
      buffer: Buffer.from(`question,option_a,option_b,answer\n${question},First,Second,a\n`),
    });
    await page.getByRole("button", { name: "Import drafts" }).click();
    await expect(page.getByText(/1 extracted.*1 ready to publish/)).toBeVisible();
  }
  await page.goto("/admin/duplicates");
  const group = page.locator("section").filter({ hasText: question });
  await expect(group.getByRole("link")).toHaveCount(2);
  const links = await group.getByRole("link").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")!));
  await group.getByRole("button", { name: "Keep these questions" }).click();
  await expect(group).toHaveCount(0);
  await page.reload();
  await expect(group).toHaveCount(0);
  for (const link of links) {
    await page.goto(link);
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    await expect(page.getByText(/1 extracted.*1 ready to publish/)).toBeVisible();
  }
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

test("enforces classification hierarchy and supports rename and removal", async ({ page }) => {
  const subject = `Admin subject ${Date.now()}`;
  const add = async (type: string, name: string, parent?: string) => {
    await page.getByLabel("Classification type").selectOption(type);
    if (parent) await page.getByLabel(type === "topic" ? "Parent subject" : "Parent topic").selectOption({ label: parent });
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Add classification" }).click();
    await expect(page.getByRole("group", { name: `${type[0].toUpperCase()}${type.slice(1)} ${name}`, exact: true })).toBeVisible();
  };
  await page.goto("/admin/settings");
  const topic = subject + " topic";
  const subtopic = subject + " subtopic";
  const tag = subject + " tag";
  await add("subject", subject);
  await add("topic", topic, subject);
  await add("subtopic", subtopic, `${subject} / ${topic}`);
  await add("tag", tag);
  const subjectRow = page.getByRole("group", { name: `Subject ${subject}`, exact: true });
  await subjectRow.getByRole("button", { name: "Remove" }).click();
  await expect(subjectRow.getByRole("alert")).toHaveText("Remove the child classifications first.");
  const tagRow = page.getByRole("group", { name: `Tag ${tag}`, exact: true });
  await tagRow.getByRole("textbox").fill("Updated " + tag);
  await tagRow.getByRole("button", { name: "Rename" }).click();
  const updated = page.getByRole("group", { name: `Tag Updated ${tag}`, exact: true });
  await expect(updated).toBeVisible();
  for (const name of [`Tag Updated ${tag}`, `Subtopic ${subtopic}`, `Topic ${topic}`, `Subject ${subject}`]) {
    const row = page.getByRole("group", { name, exact: true });
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(row).toHaveCount(0);
  }
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
