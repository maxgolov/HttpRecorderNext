import { expect, test } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://example.com');
  expect(await page.title()).toBe('Example Domain');
});
