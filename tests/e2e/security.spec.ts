import { expect, test } from "@playwright/test";

const publicUrl = process.env.SECURITY_PUBLIC_URL;

test("public service separates editor, original PDFs, and public source crops", async ({ page, request }) => {
  test.skip(!publicUrl, "Point SECURITY_PUBLIC_URL at an instance with the editor disabled.");
  await page.goto(`${publicUrl}/questions?format=table&q=House%20Committee`);
  const question = page.getByRole("article").filter({ has: page.getByRole("link", { name: "Question 6", exact: true }) });
  const asset = await question.locator(".question-content img").getAttribute("src");
  expect(asset).toBeTruthy();
  const crop = new URL(asset!, publicUrl);
  for (const path of ["/admin", "/admin/imports", "/admin/imports/new", crop.pathname.replace(/[^/]+$/, "paper.pdf"), crop.pathname.replace(/[^/]+$/, "key.pdf")]) {
    expect((await request.get(new URL(path, publicUrl).toString())).status(), path).toBe(404);
  }
  const image = await request.get(crop.toString());
  expect(image.headers()["content-type"]).toContain("image/png");
  expect(image.headers()["cache-control"]).toContain("no-store");
  expect(image.headers()["x-content-type-options"]).toBe("nosniff");
  const health = await request.get(`${publicUrl}/api/health`);
  expect(await health.json()).toEqual({ status: "ready" });
  expect(health.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(health.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(health.headers()["x-powered-by"]).toBeUndefined();
  await page.goto(`${publicUrl}/practice`);
  await page.getByLabel("Paper", { exact: true }).selectOption(process.env.POLITY_IMPORT_TITLE ?? "Polity PT-01");
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 50" })).toBeVisible();
  expect((await page.context().cookies()).find(({ name }) => name === "question_bank_profile")).toMatchObject({
    secure: true, httpOnly: true, sameSite: "Lax",
  });
});

test("practice sessions are scoped to the browser profile", async ({ page, browser }) => {
  await page.goto("/practice");
  await page.getByLabel("Paper", { exact: true }).selectOption(process.env.POLITY_IMPORT_TITLE ?? "Polity PT-01");
  await page.getByRole("button", { name: "Start test" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 50" })).toBeVisible();
  const profile = (await page.context().cookies()).find(({ name }) => name === "question_bank_profile");
  expect(profile).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  const stranger = await browser.newContext();
  try {
    expect((await stranger.request.get(page.url())).status()).toBe(404);
  } finally {
    await stranger.close();
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page.getByRole("heading", { name: "Test ended" })).toBeVisible();
});
