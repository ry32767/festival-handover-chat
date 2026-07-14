import { expect, test } from "@playwright/test";

test("passcode form exposes the expected initial state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "文化祭 引継ぎチャット" })).toBeVisible();
  const submit = page.getByRole("button", { name: "認証して始める" });
  await expect(submit).toBeDisabled();
  await page.getByLabel("共通パスコード").fill("temporary-value");
  await expect(submit).toBeEnabled();
});

test("successful authentication opens the chat workspace", async ({ page }, testInfo) => {
  await page.route("**/festival-auth", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_token: "test-session-token",
        expires_at: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
      }),
    });
  });
  await page.goto("/");
  await page.getByLabel("共通パスコード").fill("test-passcode");
  await page.getByRole("button", { name: "認証して始める" }).click();
  await expect(page.getByRole("heading", { name: "何を確認しますか？" })).toBeVisible();
  await expect(page.getByLabel("回答スタイル")).toHaveValue("standard");
  await page.getByRole("button", { name: "雨天時の注意点は？" }).click();
  await expect(page.getByRole("textbox", { name: "質問", exact: true })).toHaveValue("雨天時の注意点は？");
  await expect(page.getByRole("button", { name: "資料を検索して質問" })).toBeEnabled();
  const hasNoHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(hasNoHorizontalOverflow).toBe(true);
  await page.getByLabel("質問例").evaluate((element) => { element.scrollLeft = 0; });
  await page.screenshot({ path: testInfo.outputPath("chat-workspace.png"), fullPage: true });
});

test("local demo mode skips authentication and renders a sample answer", async ({ page }) => {
  await page.goto("/?demo=1");
  await expect(page.getByText("UI確認モード", { exact: true })).toBeVisible();
  await expect(page.getByLabel("共通パスコード")).toHaveCount(0);

  await page.getByRole("button", { name: "雨天時の注意点は？" }).click();
  await page.getByRole("button", { name: "資料を検索して質問" }).click();

  await expect(page.getByText("これはUI確認用のサンプル回答です。", { exact: false })).toBeVisible();
  await expect(page.getByText("UI確認用サンプル資料（実資料ではありません）", { exact: false })).toBeVisible();
});
