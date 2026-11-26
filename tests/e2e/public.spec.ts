import { test, expect } from "@playwright/test";
import { isFull, watchErrors } from "./helpers";
import type { Page } from "@playwright/test";

/** Open a page and wait until it is interactive (scripts loaded). */
const open = async (page: Page, path: string) => {
  const res = await page.goto(path, { waitUntil: "load" });
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(1_500);
  return res;
};

// Runs on the dev site, on deploy previews AND on the live site (@smoke).
// Read-only: never creates accounts or moves money.

test.describe("public pages @smoke", () => {
  test("home page loads with the new look and no errors", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, "/");
    await expect(page.locator("h1.dg-hero-title")).toHaveText(
      "Fintech For A New Generation",
    );
    await expect(page.getByText(/future of money/i)).toHaveCount(0);
    await expect(page.getByText(/pro mode/i)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("home buttons go to the right places", async ({ page }) => {
    await open(page, "/");
    await page
      .getByRole("button", { name: /Register/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/register$/);
    await open(page, "/");
    await page
      .getByRole("button", { name: /Sign In/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login$/);
    await open(page, "/");
    await page.locator("a[href='/register'] button").first().click();
    await expect(page).toHaveURL(/\/register$/);
    await open(page, "/");
    await expect(
      page.locator("a", { hasText: "DGEN Card" }).first(),
    ).toHaveAttribute("href", "https://card.dgentech.io");
    for (const name of ["How it works", "Roadmap"]) {
      await open(page, "/");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole("button", { name }).first().click();
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(300);
    }
  });

  test("outside links open safely in a new tab", async ({ page }) => {
    await open(page, "/");
    await page.waitForTimeout(5_000); // let lazy sections render
    const bad = await page.$$eval("a[target=_blank]", (els) =>
      els
        .filter((a) => !/noopener/.test(a.getAttribute("rel") || ""))
        .map((a) => `${a.getAttribute("href")} [rel=${a.getAttribute("rel")}]`),
    );
    expect(bad).toEqual([]);
  });

  test("register page controls work", async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, "/register");
    await expect(page.locator(".dg-auth-brand")).toHaveText("Join DGEN");
    const submit = page.locator("button[type=submit]");
    await expect(submit).toBeDisabled();
    await page.check("#termsAcceptedCheckbox");
    await expect(submit).toBeEnabled();
    const user = page.locator("input[name=username]");
    const before = await user.inputValue();
    await page.getByRole("button", { name: "Randomize" }).click();
    await expect.poll(() => user.inputValue()).not.toBe(before);
    await page
      .getByRole("button", { name: "terms & conditions", exact: true })
      .click();
    await expect(page.locator(".fixed.inset-0.z-50")).toBeVisible();
    await open(page, "/register");
    await page.locator("a[href^='/login'] button").click();
    await expect(page).toHaveURL(/\/login/);
    expect(errors).toEqual([]);
  });

  test("sign-in page controls work", async ({ page }) => {
    await open(page, "/login");
    await expect(page.locator(".dg-auth h1")).toHaveText("Welcome Back");
    await page.locator("a[href^='/register'] button").click();
    await expect(page).toHaveURL(/\/register/);
    await open(page, "/login");
    await page.locator(".dg-nav-logo").click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("info pages load", async ({ page }) => {
    for (const path of ["/faq", "/terms"]) {
      const res = await open(page, path);
      expect(res?.status(), path).toBeLessThan(400);
    }
  });

  test("security headers are in place", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["strict-transport-security"]).toContain("max-age");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
  });
});

test("wrong password is rejected", async ({ page }) => {
  test.skip(!isFull, "dev only");
  await open(page, "/login");
  await page.fill("input[name=username]", "qa-does-not-exist-" + Date.now());
  await page.fill("#password", "wrong-password-123");
  await page.click("button[type=submit]");
  await page.waitForTimeout(5_000);
  await expect(page).toHaveURL(/\/login/);
});
