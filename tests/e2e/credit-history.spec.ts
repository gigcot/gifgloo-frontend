import { expect, test } from "@playwright/test";

test("survey reward is not a purchase and does not expose internal experiment text", async ({ page }) => {
  await page.route("https://cloud.umami.is/script.js", (route) => route.abort());
  await page.route("**/users/me", (route) => route.fulfill({
    json: { user_id: "history-user", email: "history@example.com" },
  }));
  await page.route("**/experiments/exp-001/survey", (route) => route.fulfill({
    json: { eligible: true, submitted: true },
  }));
  await page.route("**/credits/balance", (route) => route.fulfill({
    json: { balance: 30, remaining_uses: 3, nearest_expires_at: null },
  }));
  await page.route("**/credits/lots", (route) => route.fulfill({
    json: { items: [], has_more: false, next_cursor: null },
  }));
  await page.route("**/credits/history", (route) => route.fulfill({
    json: {
      items: [
        { transaction_type: "CHARGE", source_type: "EXPERIMENT", reason: "설문 참여 보상" },
        { transaction_type: "CHARGE", source_type: "EXPERIMENT", reason: "EXP-001 설문 참여 보상" },
        { transaction_type: "CHARGE", source_type: "PAYMENT", reason: null },
        { transaction_type: "DEDUCT", source_type: "COMPOSITION", reason: null },
        { transaction_type: "REFUND", source_type: "COMPOSITION", reason: "합성 실패 이용권 복구" },
      ].map((item, index) => ({
        ...item,
        transaction_id: `transaction-${index}`,
        signed_amount: item.transaction_type === "DEDUCT" ? -10 : 10,
        uses: 1,
        source_id: `source-${index}`,
        credit_lot_id: `lot-${index}`,
        balance_after_uses: 3,
        created_at: "2026-09-29T03:00:00Z",
      })),
      has_more: false,
      next_cursor: null,
    },
  }));

  await page.goto("/payment/history");
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0).getByText("설문 참여 보상", { exact: true })).toBeVisible();
  await expect(rows.nth(1).getByText("설문 참여 보상", { exact: true })).toBeVisible();
  await expect(rows.nth(2).getByText("이용권 구매", { exact: true })).toBeVisible();
  await expect(rows.nth(3).getByText("GIF 합성 사용", { exact: true })).toBeVisible();
  await expect(rows.nth(4).getByText("합성 실패 이용권 복구", { exact: true })).toBeVisible();
  await expect(page.getByText(/EXP-001/)).toHaveCount(0);
});
