import { expect } from "@playwright/test";
import {
  gotoApp,
  importSeed,
  isFull,
  login,
  register,
  watchErrors,
  prepContext,
  test,
} from "./helpers";

// Dev site only: creates throwaway accounts with random names and passwords.
test.skip(!isFull, "creates accounts: dev only");

const readPhrase = async (page) => {
  await gotoApp(page, "/settings/security");
  await page.getByRole("button", { name: "Reveal Recovery Phrase" }).click();
  await page.getByRole("button", { name: /Private Place/ }).click();
  await page.waitForTimeout(3_000);
  const words = [
    ...(await page.locator("body").innerText()).matchAll(
      /#\d{1,2}\s*\n\s*([a-z]+)/g,
    ),
  ].map((m) => m[1]);
  return words.slice(0, 12);
};

test("register, log out, log back in", async ({ page }) => {
  const errors = watchErrors(page);
  const creds = await register(page);
  await expect(page.getByText(creds.username).first()).toBeVisible();
  await page.goto("/logout");
  await page.waitForTimeout(4_000);
  await expect(page).not.toHaveURL(new RegExp(`/${creds.username}$`));
  await login(page, creds);
  await expect(page.getByText(creds.username).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("recovery phrase shows 12 words and restores on another account", async ({
  browser,
}) => {
  const a = await prepContext(await browser.newContext());
  const pa = await a.newPage();
  await register(pa);
  const words = await readPhrase(pa);
  expect(words).toHaveLength(12);
  await a.close();

  const b = await prepContext(await browser.newContext());
  const pb = await b.newPage();
  await register(pb);
  await importSeed(pb, words.join(" "));
  expect(await readPhrase(pb)).toEqual(words);
  await b.close();
});
