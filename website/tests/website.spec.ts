import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('presents honest product messaging and real project destinations', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/TerminalOne.*Every shell/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'One terminal. Every shell.',
  );
  await expect(page.getByText('DESIGN CONCEPT')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'View on GitHub', exact: true }).first(),
  ).toHaveAttribute('href', 'https://github.com/dineshkorukonda/TerminalOne');
  await expect(page.getByRole('link', { name: /download/i })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Your tools. One workspace.' }),
  ).toBeVisible();
  await expect(page.locator('a[href*="milestone"]')).toHaveCount(0);
  const links = await page
    .locator('a[href]')
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute('href')),
    );
  expect(
    links.every(
      (href) =>
        href &&
        (href.startsWith('#') ||
          href.startsWith('https://github.com/dineshkorukonda/TerminalOne')),
    ),
  ).toBe(true);
});

test('switches clean shell previews and supports tab keyboard navigation', async ({
  page,
}) => {
  await page.goto('/');
  const powershell = page.getByRole('tab', { name: 'PowerShell', exact: true });
  const cmd = page.getByRole('tab', { name: 'CMD', exact: true });
  const bash = page.getByRole('tab', { name: 'Git Bash', exact: true });
  await expect(powershell).toHaveAttribute('aria-selected', 'true');
  await cmd.click();
  await expect(cmd).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText(
    'For command-line tools and batch scripts.',
  );
  await cmd.press('ArrowRight');
  await expect(bash).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText(
    'For Git and familiar Bash commands.',
  );
  await bash.press('ArrowRight');
  await expect(powershell).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('PowerShell');
  await powershell.press('End');
  await expect(bash).toBeFocused();
  await bash.press('Home');
  await expect(powershell).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
});

test('mobile menu opens, closes on navigation, and restores focus with Escape', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Toggle navigation' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Features', exact: true })
    .click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
});

test('FAQ discloses the release status and remains keyboard operable', async ({
  page,
}) => {
  await page.goto('/');
  const question = page
    .locator('summary')
    .filter({ hasText: 'Can I download TerminalOne today?' });
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('Not yet. TerminalOne is in development.'),
  ).toBeVisible();
});

test('production page has no serious accessibility violations', async ({
  page,
}) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('fits narrow and wide layouts without runtime errors or missing local assets', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      response.url().startsWith('http://127.0.0.1:4321') &&
      response.status() >= 400
    )
      errors.push(response.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
    await expect(
      page.getByRole('link', { name: 'View on GitHub', exact: true }).first(),
    ).toHaveCSS('transition-duration', '0s');
  }
  expect(errors).toEqual([]);
});

test('keeps core content and navigation available without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Features' }),
  ).toBeVisible();
  await expect(page.getByRole('tabpanel')).toContainText('PowerShell');
  await page
    .locator('summary')
    .filter({ hasText: 'Can I download TerminalOne today?' })
    .click();
  await expect(
    page.getByText('Not yet. TerminalOne is in development.'),
  ).toBeVisible();
  await context.close();
});
