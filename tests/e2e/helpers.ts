import { expect, type Page, type BrowserContext } from "@playwright/test";
import { randomBytes } from "node:crypto";

export const MODE = process.env.E2E_MODE || "full"; // "full" (dev) or "smoke" (live)
export const isFull = MODE === "full";

/** Throwaway credentials, generated fresh for each run. Never reused. */
export const newCreds = () => ({
  username: "qa" + randomBytes(5).toString("hex"),
  password: randomBytes(18).toString("base64url"),
});

/** Collect uncaught page errors so every test can assert none happened. */
export const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  return errors;
};

/** The wallet runs in one tab at a time. If a previous page load still holds
 * the lock, take it over so the test page is not stuck in view-only mode. */
export const takeTab = async (page: Page) => {
  const use = page.getByRole("button", { name: "Use This Tab" }).first();
  if (await use.isVisible().catch(() => false)) {
    await use.click();
    const yes = page.getByRole("button", { name: "Yes, Use This Tab" });
    if (await yes.isVisible({ timeout: 3_000 }).catch(() => false))
      await yes.click();
    await page.waitForTimeout(3_000);
  }
};

export const gotoApp = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6_000); // wallet SDK start-up
  await takeTab(page);
};

export const register = async (page: Page, creds = newCreds()) => {
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await page.fill("input[name=username]", creds.username);
  await page.fill("#password", creds.password);
  await page.fill("#confirmPassword", creds.password);
  await page.check("#termsAcceptedCheckbox");
  await page.click("button[type=submit]");
  await page.waitForURL(new RegExp(`/${creds.username}$`), { timeout: 90_000 });
  return creds;
};

export const login = async (
  page: Page,
  creds: { username: string; password: string },
) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.fill("input[name=username]", creds.username);
  await page.fill("#password", creds.password);
  await page.click("button[type=submit]");
  await page.waitForURL(new RegExp(`/${creds.username}$`), { timeout: 90_000 });
};

/** Type a number on the in-app keypad (digits and "."), then press Ok. */
export const keypad = async (page: Page, value: string) => {
  const clear = page.getByRole("button", { name: "Clear", exact: true });
  if (await clear.isVisible().catch(() => false)) await clear.click();
  for (const ch of value)
    await page.getByRole("button", { name: ch, exact: true }).first().click();
  await page.getByRole("button", { name: "Ok", exact: true }).click();
};

/** Create a Lightning invoice on the Receive page for a USD amount. */
export const createInvoice = async (
  page: Page,
  username: string,
  usd: string,
) => {
  await gotoApp(page, `/${username}/receive`);
  await page.getByRole("button", { name: /Set amount/ }).click();
  await keypad(page, usd);
  await expect
    .poll(async () => (await page.content()).match(/lnbc[0-9a-z]{50,}/i)?.[0], {
      timeout: 90_000,
    })
    .toBeTruthy();
  return (await page.content()).match(/lnbc[0-9a-z]{50,}/i)![0];
};

/** Replace the browser's wallet with the one from a recovery phrase. */
export const importSeed = async (page: Page, phrase: string) => {
  await gotoApp(page, "/settings/security");
  await page.getByRole("button", { name: "Import from Seed Phrase" }).click();
  await page.locator("textarea[placeholder*='12 words']").fill(phrase.trim());
  await page.getByRole("button", { name: "Restore Wallet" }).click();
  await page.getByRole("button", { name: "YES, REPLACE MY WALLET" }).click();
  await page.waitForTimeout(25_000); // SDK sync
};

/** Read the wallet balance in sats from the home screen. */
export const balanceSats = async (page: Page, username: string) => {
  await gotoApp(page, `/${username}`);
  await page.getByRole("button", { name: "sats", exact: true }).first().click();
  await page.waitForTimeout(2_000);
  const text = await page.locator("body").innerText();
  const m = text.match(/([\d,]+)\s*\n?\s*sats/i) || text.match(/⚡\s*([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : NaN;
};

export const newContext = async (browser: {
  newContext: () => Promise<BrowserContext>;
}) => browser.newContext();
