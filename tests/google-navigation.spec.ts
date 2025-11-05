/**
 * Example Playwright test that records HTTP traffic via Dev Proxy
 * 
 * This test demonstrates:
 * - Navigation to Google homepage
 * - Search functionality
 * - HTTP traffic recording to HAR file
 * - Proxy integration without system-wide configuration
 */

import { expect, test } from '@playwright/test';

test.describe('Google Navigation Tests', () => {
  test.beforeEach(async ({ context }) => {
    // Log proxy configuration
    console.log('🔌 Using proxy configuration:', context.browser()?.version());
  });

  test('should navigate to Google homepage', async ({ page }) => {
    console.log('📍 Navigating to Google homepage...');
    
    // Navigate to Google
    await page.goto('https://www.google.com');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Verify we're on Google
    await expect(page).toHaveTitle(/Google/);
    
    // Check for search box
    const searchBox = page.getByRole('combobox', { name: /search/i });
    await expect(searchBox).toBeVisible();
    
    console.log('✅ Google homepage loaded successfully');
  });

  test('should perform a search on Google', async ({ page }) => {
    console.log('🔍 Testing Google search functionality...');
    
    // Navigate to Google
    await page.goto('https://www.google.com');
    await page.waitForLoadState('networkidle');
    
    // Find and fill the search box
    const searchBox = page.getByRole('combobox', { name: /search/i });
    await searchBox.fill('Playwright testing');
    
    // Submit the search (press Enter)
    await searchBox.press('Enter');
    
    // Wait for search results
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the results page
    await expect(page).toHaveURL(/google\.com\/search/);
    
    // Check that we have search results
    const searchResults = page.locator('#search');
    await expect(searchResults).toBeVisible();
    
    console.log('✅ Search completed successfully');
  });

  test('should load Google Images', async ({ page }) => {
    console.log('🖼️ Testing Google Images...');
    
    // Navigate to Google
    await page.goto('https://www.google.com');
    await page.waitForLoadState('networkidle');
    
    // Click on Images link
    const imagesLink = page.getByRole('link', { name: /images/i });
    
    if (await imagesLink.isVisible()) {
      await imagesLink.click();
      await page.waitForLoadState('networkidle');
      
      // Verify we're on Google Images
      await expect(page).toHaveURL(/google\.com.*\/imghp/);
      
      console.log('✅ Google Images loaded successfully');
    } else {
      console.log('⚠️ Images link not found, skipping');
    }
  });

  test('should handle Google consent dialog', async ({ page }) => {
    console.log('🍪 Testing consent dialog handling...');
    
    // Navigate to Google
    await page.goto('https://www.google.com');
    
    // Wait a bit for consent dialog to appear
    await page.waitForTimeout(2000);
    
    // Check if consent dialog appears
    const acceptButton = page.getByRole('button', { name: /accept|agree/i });
    
    if (await acceptButton.isVisible()) {
      console.log('✅ Consent dialog detected');
      await acceptButton.click();
      console.log('✅ Consent accepted');
    } else {
      console.log('ℹ️ No consent dialog appeared');
    }
    
    // Verify page is functional after consent
    await page.waitForLoadState('networkidle');
    const searchBox = page.getByRole('combobox', { name: /search/i });
    await expect(searchBox).toBeVisible();
    
    console.log('✅ Page functional after consent handling');
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Log test completion
    const status = testInfo.status === 'passed' ? '✅' : '❌';
    console.log(`${status} Test "${testInfo.title}" ${testInfo.status}`);
    
    // Take screenshot on failure
    if (testInfo.status !== 'passed') {
      const screenshot = await page.screenshot();
      await testInfo.attach('screenshot', {
        body: screenshot,
        contentType: 'image/png'
      });
    }
  });
});

/**
 * Advanced test demonstrating API call interception
 */
test.describe('HTTP Traffic Recording', () => {
  test('should record all HTTP requests', async ({ page }) => {
    console.log('📝 Recording HTTP traffic...');
    
    // Track requests
    const requests: string[] = [];
    
    page.on('request', request => {
      requests.push(`${request.method()} ${request.url()}`);
    });
    
    // Navigate and interact
    await page.goto('https://www.google.com');
    await page.waitForLoadState('networkidle');
    
    // Perform a search
    const searchBox = page.getByRole('combobox', { name: /search/i });
    await searchBox.fill('HTTP Archive');
    await searchBox.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Log recorded requests
    console.log(`📊 Recorded ${requests.length} HTTP requests`);
    console.log('Sample requests:');
    requests.slice(0, 5).forEach((req, idx) => {
      console.log(`  ${idx + 1}. ${req}`);
    });
    
    // Verify we captured traffic
    expect(requests.length).toBeGreaterThan(0);
    
    console.log('✅ HTTP traffic recorded successfully');
    console.log('💾 HAR file saved to recordings/ directory');
  });
});
