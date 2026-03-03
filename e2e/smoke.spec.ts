import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("health endpoint returns healthy", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("ok");
  });

  test("unauthenticated users are redirected to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/sign-in/, { timeout: 10000 });
    expect(page.url()).toContain("sign-in");
  });

  test("sign-in page loads and renders Clerk UI", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("body")).toBeVisible();
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test("unauthenticated API requests are rejected", async ({ request }) => {
    const res = await request.get("/api/companies");
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("not-found page renders for unknown routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    const content = await page.textContent("body");
    expect(content).toBeTruthy();
  });
});
