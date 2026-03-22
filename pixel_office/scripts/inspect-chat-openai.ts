// scripts/inspect-chat-openai.ts
// explore chat.openai.com's capabilities and limitations.
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://chat.openai.com', { waitUntil: 'domcontentloaded' });

  const title = await page.title();
  console.log('Page title:', JSON.stringify(title));

  // Very shallow capability heuristics:
  const selectors = [
    'input[type="email"]',
    'input[type="password"]',
    'button:has-text("Log in")',
    'button:has-text("Sign up")',
    'textarea',
    'button:has-text("New chat")',
  ];

  for (const sel of selectors) {
    const count = await page.locator(sel).count();
    console.log(`Selector ${JSON.stringify(sel)} count:`, count);
  }

  // Dump some top-level ARIA landmarks as a hint of structure
  const roles = ['main', 'navigation', 'banner', 'contentinfo'];
  for (const role of roles) {
    const count = await page.getByRole(role as any).count();
    console.log(`Role ${role} count:`, count);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
