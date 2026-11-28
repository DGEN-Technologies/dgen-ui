import { expect, type Page } from "@playwright/test";
import {
  createInvoice,
  gotoApp,
  isFull,
  register,
  watchErrors,
  prepContext,
  test,
} from "./helpers";

// Every main wallet screen, logged in with one fresh throwaway account.
// Dev site only. Never sends money: the send test stops at the confirm screen.
test.skip(!isFull, "creates accounts: dev only");

let page: Page;
let username = "";
let errors: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await (await prepContext(await browser.newContext())).newPage();
  errors = watchErrors(page);
  username = (await register(page)).username;
});
test.afterAll(async () => page.context().close());

test("home shows balance and unit switches", async () => {
  await gotoApp(page, `/${username}`);
  for (const name of ["Receive", "Send", "Swap or Buy", "Scan"])
    await expect(page.getByRole("button", { name }).first()).toBeVisible();
  for (const unit of ["BTC", "sats"]) {
    await page.getByRole("button", { name: unit, exact: true }).first().click();
    await expect(page.locator("body")).toContainText(
      unit === "sats" ? "sats" : "BTC",
    );
  }
});

test("receive: creates a Lightning invoice", async () => {
  const invoice = await createInvoice(page, username, "1");
  expect(invoice).toMatch(/^lnbc/i);
  await expect(
    page.getByRole("button", { name: "Copy" }).first(),
  ).toBeVisible();
});

test("receive: other deposit options", async () => {
  await gotoApp(page, `/${username}/receive`);
  await page.getByRole("button", { name: /More deposit options/ }).click();
  for (const opt of [
    /Liquid Network/,
    /Bitcoin \(on-chain\)/,
    /Lightning Address/,
  ])
    await expect(page.getByRole("button", { name: opt })).toBeVisible();
  await page.getByRole("button", { name: /Bitcoin \(on-chain\)/ }).click();
  await expect
    .poll(async () => /\bbc1[a-z0-9]{20,}/i.test(await page.content()), {
      timeout: 60_000,
    })
    .toBe(true);
});

test("send: reads an invoice and stops at the confirm screen", async () => {
  const invoice = await createInvoice(page, username, "1");
  await gotoApp(page, "/send");
  await page.fill("textarea[name=text]", invoice);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/send\/lightning\//);
  await expect(
    page.getByRole("button", { name: "Send Payment" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click(); // never pays
});

test("send: rejects nonsense input", async () => {
  await gotoApp(page, "/send");
  await page.fill("textarea[name=text]", "this-is-not-a-payment");
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForTimeout(4_000);
  await expect(page).toHaveURL(/\/send$/);
});

test("transaction history loads", async () => {
  await gotoApp(page, "/payments");
  await expect(page.getByRole("button", { name: "Date Range" })).toBeVisible();
});

test("settings: account currency saves", async () => {
  await gotoApp(page, "/settings/account");
  const sel = page.locator("select[name=currency]");
  await sel.selectOption("CAD");
  await page.getByRole("button", { name: /Save settings/ }).click();
  await page.waitForTimeout(3_000);
  await gotoApp(page, "/settings/account");
  await expect(page.locator("select[name=currency]")).toHaveValue("CAD");
});

test("settings: profile display name saves", async () => {
  await gotoApp(page, "/settings/profile");
  const name = "QA " + Date.now().toString().slice(-6);
  await page.fill("input[name=display]", name);
  await page.getByRole("button", { name: /Save settings/ }).click();
  await page.waitForTimeout(3_000);
  await gotoApp(page, "/settings/profile");
  await expect(page.locator("input[name=display]")).toHaveValue(name);
});

test("settings: lightning address page", async () => {
  await gotoApp(page, "/settings/lightning-address");
  await expect(
    page.getByText("Here you can modify your Lightning Address"),
  ).toBeVisible();
  // Either a registration form or the user's existing address is shown.
  await expect(
    page
      .getByRole("button", { name: /Register Lightning Address/ })
      .or(page.getByText(/@[a-z0-9.-]+\.[a-z]{2,}/i).first()),
  ).toBeVisible();
});

test("settings: security tools open", async () => {
  await gotoApp(page, "/settings/security");
  await page.getByRole("button", { name: "Set up 2FA" }).click();
  await expect(
    page.getByRole("button", { name: "Confirm Setup" }),
  ).toBeVisible();
  await gotoApp(page, "/settings/security");
  await page.getByRole("button", { name: "Enable PIN" }).click();
  await expect(
    page.getByRole("button", { name: "C", exact: true }),
  ).toBeVisible();
});

test("swap: provider can be shown inside the app", async ({ request }) => {
  await gotoApp(page, "/swap");
  const src = await page.locator("iframe").first().getAttribute("src");
  expect(src, "swap iframe present").toBeTruthy();
  const res = await request.get(src!, { headers: { Referer: page.url() } });
  const body = await res.text();
  // SwapSpace puts test servers behind a Cloudflare bot check. That page is not
  // what real visitors get, so report it instead of failing on it.
  test.skip(
    res.status() === 403 && body.includes("challenges.cloudflare.com"),
    "SwapSpace bot check blocks test servers; verify Swap by hand",
  );
  const xfo = (res.headers()["x-frame-options"] || "").toLowerCase();
  expect(
    xfo,
    `swap provider blocks embedding (X-Frame-Options: ${xfo})`,
  ).not.toMatch(/sameorigin|deny/);
});

test("buy: opens MoonPay checkout for this wallet", async () => {
  await gotoApp(page, `/${username}`);
  await page.getByRole("button", { name: "Buy Bitcoin" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/moonpay\.com/, { timeout: 60_000 });
  const url = new URL(page.url());
  // MoonPay must be told where to send the Bitcoin.
  expect(url.searchParams.get("walletAddress") || "").toMatch(/^(bc1|lq1|tb1)/);
});

test("scan page opens", async () => {
  const res = await page.goto("/scan");
  expect(res?.status()).toBeLessThan(400);
});

test("no uncaught errors on any wallet screen", async () => {
  expect(errors).toEqual([]);
});
