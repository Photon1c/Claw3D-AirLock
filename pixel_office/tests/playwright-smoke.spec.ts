import { test, expect } from '@playwright/test';

test('loads Pixel Office dev page', async ({ page }) => {
  // Adjust port if your dev server uses a different one
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  // Adapt the title or selector if needed
  await expect(page).toHaveTitle(/Pixel Office/i);
});
