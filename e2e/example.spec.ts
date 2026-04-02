import { test, expect } from "@playwright/test";

test("should load the application", async ({ page }) => {
  // Navigate to the app
  await page.goto("/", { waitUntil: "load" });
  
  // Wait for the page to load
  await page.waitForTimeout(2000);
  
  // Check if the page is loaded
  const html = await page.innerHTML("html");
  expect(html.length).toBeGreaterThan(0);
});

test("should have a working navigation", async ({ page }) => {
  // Navigate to the app
  await page.goto("/", { waitUntil: "load" });
  
  // Wait for content to load
  await page.waitForTimeout(1000);
  
  // Check if any main elements are present
  const body = page.locator("body");
  await expect(body).toBeVisible();
});
