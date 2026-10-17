import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import { resolve } from 'node:path';

const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
  });
  await page.goto(
    pathToFileURL(resolve(publicDirectory, 'social-card.svg')).href,
  );
  await page.screenshot({ path: resolve(publicDirectory, 'social-card.png') });
} finally {
  await browser.close();
}
