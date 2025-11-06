import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for recording HTTP traffic via Dev Proxy
 * 
 * This configuration sets up Playwright to route traffic through Dev Proxy
 * for HAR recording without requiring system-wide proxy configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests serially to avoid proxy conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to ensure clean proxy state
  reporter: [
    ['html'],
    ['list']
  ],
  
  use: {
    // Base URL for testing
    baseURL: process.env.BASE_URL || 'https://www.google.com',
    
    // Proxy configuration - Dev Proxy listens on localhost:8080
    proxy: {
      server: process.env.PROXY_URL || 'http://localhost:8080',
      bypass: 'localhost,127.0.0.1' // Don't proxy local requests
    },
    
    // Browser context options
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Ignore HTTPS errors (Dev Proxy uses self-signed certificate)
    ignoreHTTPSErrors: true,
    
    // Timeout settings
    actionTimeout: 10000,
    navigationTimeout: 30000
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Accept Dev Proxy's self-signed certificate
        ignoreHTTPSErrors: true
      }
    }
  ],
});
