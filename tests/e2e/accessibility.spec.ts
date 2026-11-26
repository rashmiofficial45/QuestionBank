import { expect, test } from "@playwright/test";
import { checkAccessibility } from "./verify-accessibility";

test("each PDF can be removed or replaced before uploading", async ({ page }) => {
  test.skip(process.env.EDITORIAL_ACCESSIBILITY !== "1", "Enable for the local operator preview.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/imports/new");
  await page.getByRole("button", { name: "Toggle black and white theme" }).click();
  const names = ["Question paper PDF", "Answer key PDF", "Explanation PDF"];
  const chooser = (name: string) => page.getByLabel(name === "Explanation PDF" ? `${name} (optional)` : name, { exact: true });
  const file = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-fixture") });
  for (const name of names) await chooser(name).setInputFiles(file("first-selection.pdf"));
  for (const name of names) {
    const input = chooser(name);
    const clear = page.getByRole("button", { name: `Remove ${name}`, exact: true });
    await clear.click();
    await expect(clear).toHaveCount(0);
    await expect(input).toBeFocused();
    expect(await input.evaluate((element: HTMLInputElement) => element.files?.length)).toBe(0);
    await input.setInputFiles(file("replacement.pdf"));
    await expect(clear).toBeVisible();
    expect(await input.evaluate((element: HTMLInputElement) => element.files?.[0]?.name)).toBe("replacement.pdf");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await checkAccessibility(page, "PDF selections with remove controls in Black");
});

test("student workspace passes accessibility checks in White and Black", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  for (const theme of ["White", "Black"]) {
    for (const path of ["/", "/questions", "/practice", "/progress", "/bookmarks", "/revision"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await checkAccessibility(page, `${theme} ${path}`);
    }
    if (theme === "White") await page.getByRole("button", { name: "Toggle black and white theme" }).click();
  }
});

test("practice controls remain accessible at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/practice");
  await page.getByLabel("Paper", { exact: true }).selectOption(process.env.POLITY_IMPORT_TITLE ?? "Polity PT-01");
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 50" })).toBeVisible();
  await checkAccessibility(page, "Mobile active test");
  await page.keyboard.press("ArrowDown");
  const first = page.locator(".test-options button[name=option]").first();
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Answer saved", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("heading", { name: "Test ended" })).toBeVisible();
  await checkAccessibility(page, "Mobile results");
  const topicScroll = page.getByRole("region", { name: "Performance by topic scroll area" });
  await expect(topicScroll).toHaveAttribute("tabindex", "0");
  await topicScroll.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => topicScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Review answers" }).click();
  await checkAccessibility(page, "Mobile test review");
});

test("editorial pages have accessible controls", async ({ page }) => {
  test.skip(process.env.EDITORIAL_ACCESSIBILITY !== "1", "Enable for the local operator preview.");
  for (const path of ["/admin", "/admin/imports", "/admin/imports/new"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await checkAccessibility(page, path);
  }
  await page.goto("/admin/imports");
  await page.locator(".import-row").filter({ hasText: process.env.POLITY_IMPORT_TITLE ?? "Polity PT-01" }).first().click();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit draft questions" })).toBeVisible();
  await checkAccessibility(page, "Editor");
});
