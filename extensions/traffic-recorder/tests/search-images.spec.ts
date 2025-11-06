/**
 * Example Playwright test with Dev Proxy traffic recording
 * 
 * This test demonstrates:
 * - Configuring proxy settings for Dev Proxy
 * - Navigating to Google Images
 * - Performing a search
 * - Waiting for network activity
 * 
 * To run:
 * 1. Start Dev Proxy: npm run start:proxy (or use VS Code command)
 * 2. Run this test: npx playwright test examples/search-images.spec.ts
 * 3. Check .http-recorder/ directory for HAR files
 * 4. Open HAR file in VS Code and click "Preview" to view recorded traffic
 */

import { expect, test } from '@playwright/test';

// Configure browser to use Dev Proxy
test.use({
  proxy: {
    server: 'http://localhost:8080',
    bypass: '<-loopback>' // Critical: allows localhost interception
  },
  // Ignore HTTPS errors since Dev Proxy uses self-signed certificates
  ignoreHTTPSErrors: true,
});

test('Search for cats on Google Images', async ({ page }) => {
  // Navigate to Google Images
  console.log('Navigating to Google Images...');
  await page.goto('https://images.google.com', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Accept cookies if prompted (may vary by region)
  try {
    const acceptButton = page.locator('button:has-text("Accept all"), button:has-text("I agree")').first();
    if (await acceptButton.isVisible({ timeout: 3000 })) {
      await acceptButton.click();
      console.log('Accepted cookies');
    }
  } catch (e) {
    console.log('No cookie banner found or already accepted');
  }

  // Find the search box and type "cats"
  console.log('Searching for cats...');
  const searchBox = page.locator('textarea[name="q"], input[name="q"]').first();
  await searchBox.waitFor({ state: 'visible', timeout: 10000 });
  await searchBox.fill('cats');
  
  // Press Enter to search
  await searchBox.press('Enter');
  
  // Wait for search results to load
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  
  // Verify we're on the results page
  await expect(page).toHaveURL(/.*q=cats.*/);
  console.log('Search results loaded');

  // Wait for images to appear
  const images = page.locator('img[data-src], img[src*="gstatic"]');
  await images.first().waitFor({ state: 'visible', timeout: 10000 });
  
  const imageCount = await images.count();
  console.log(`Found ${imageCount} images on the page`);

  // Wait for 20 seconds to capture all network traffic
  console.log('Waiting 20 seconds to capture traffic...');
  await page.waitForTimeout(20000);
  
  console.log('Test complete! Check .http-recorder/ for HAR files');
});

test('Alternative: Search with screenshot', async ({ page }) => {
  // This example also takes a screenshot for visual verification
  
  await page.goto('https://images.google.com', {
    waitUntil: 'networkidle'
  });

  // Accept cookies
  try {
    await page.locator('button:has-text("Accept all"), button:has-text("I agree")').first().click({ timeout: 3000 });
  } catch (e) {
    // Continue if no cookie banner
  }

  // Search for cats
  await page.locator('textarea[name="q"], input[name="q"]').first().fill('cats');
  await page.keyboard.press('Enter');
  
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot
  await page.screenshot({ 
    path: '.http-recorder/search-results.png',
    fullPage: true 
  });
  
  console.log('Screenshot saved to .http-recorder/search-results.png');
  
  // Wait to capture traffic
  await page.waitForTimeout(20000);
});

test('Example: Click on first image', async ({ page }) => {
  // This example shows how to interact with the search results
  
  await page.goto('https://images.google.com', {
    waitUntil: 'networkidle'
  });

  try {
    await page.locator('button:has-text("Accept all"), button:has-text("I agree")').first().click({ timeout: 3000 });
  } catch (e) {
    // Continue
  }

  // Search
  await page.locator('textarea[name="q"], input[name="q"]').first().fill('cats');
  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle');

  // Click the first image result
  const firstImage = page.locator('img[data-src], div[data-ri="0"]').first();
  await firstImage.waitFor({ state: 'visible', timeout: 10000 });
  await firstImage.click();
  
  console.log('Clicked first image');
  
  // Wait for the image detail panel to load
  await page.waitForTimeout(5000);
  
  // Wait additional time to capture all lazy-loaded content
  await page.waitForTimeout(15000);
  
  console.log('Captured image detail view traffic');
});
