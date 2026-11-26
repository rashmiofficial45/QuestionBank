import { expect, test } from "@playwright/test";

const title = process.env.POLITY_IMPORT_TITLE ?? "Polity PT-01";

test("matches the table question layout in both themes at desktop and mobile widths", async ({ page }) => {
  test.skip(process.env.VISUAL_REGRESSION !== "1", "Enable with VISUAL_REGRESSION=1 on a host with matching snapshots.");
  const params = new URLSearchParams({ source: title, format: "table", q: "House Committee" });
  await page.goto(`/questions?${params}`);
  const question = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Question 6", exact: true }) });
  await expect(question.getByRole("table")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(question).toHaveScreenshot("table-question-desktop.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });

  await page.getByRole("button", { name: "Toggle black and white theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(question).toHaveScreenshot("table-question-mobile-dark.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
});
