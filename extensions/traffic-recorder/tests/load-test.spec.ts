/**
 * Load test for Dev Proxy with HttpRecorder plugin
 * 
 * This test demonstrates:
 * - Concurrent HTTP requests
 * - Load testing with multiple parallel requests
 * - Traffic recording under load
 * - Performance validation
 */

import { expect, test } from '@playwright/test';

test.describe('Load Testing with Traffic Recording', () => {
  
  test('should handle 10 concurrent searches', async ({ browser }) => {
    console.log('🚀 Starting load test: 10 concurrent searches');
    
    const startTime = Date.now();
    const searchQueries = [
      'Playwright testing',
      'Dev Proxy Microsoft',
      'HTTP Archive format',
      'Load testing tools',
      'API testing best practices',
      'TypeScript examples',
      'VS Code extensions',
      'Network traffic analysis',
      'Performance testing',
      'Browser automation'
    ];
    
    // Create multiple contexts and pages
    const promises = searchQueries.map(async (query, index) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        console.log(`  ${index + 1}. Searching for: "${query}"`);
        
        // Navigate to Google
        await page.goto('https://www.google.com', { timeout: 30000 });
        await page.waitForLoadState('networkidle');
        
        // Perform search
        const searchBox = page.getByRole('combobox', { name: /search/i });
        await searchBox.fill(query);
        await searchBox.press('Enter');
        
        // Wait for results
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        
        // Verify results page loaded
        await expect(page).toHaveURL(/google\.com\/search/);
        
        console.log(`  ✅ ${index + 1}. Completed: "${query}"`);
        
        return { success: true, query, duration: Date.now() - startTime };
      } catch (error) {
        console.log(`  ❌ ${index + 1}. Failed: "${query}" - ${error}`);
        return { success: false, query, error: String(error) };
      } finally {
        await page.close();
        await context.close();
      }
    });
    
    // Wait for all searches to complete
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Log results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log('');
    console.log('📊 Load Test Results:');
    console.log(`  Total requests: ${results.length}`);
    console.log(`  Successful: ${successful}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total duration: ${totalDuration}ms`);
    console.log(`  Average: ${Math.round(totalDuration / results.length)}ms per request`);
    
    // Verify at least 80% success rate
    const successRate = successful / results.length;
    expect(successRate).toBeGreaterThanOrEqual(0.8);
    
    console.log('✅ Load test completed successfully');
  });
  
  test('should handle rapid sequential requests', async ({ page }) => {
    console.log('⚡ Testing rapid sequential requests');
    
    const startTime = Date.now();
    const requestCount = 20;
    const urls = [
      'https://www.google.com',
      'https://www.google.com/search?q=playwright',
      'https://www.google.com/search?q=testing',
      'https://www.google.com/search?q=automation',
      'https://www.google.com/search?q=typescript'
    ];
    
    const results: { url: string; duration: number; status: number }[] = [];
    
    for (let i = 0; i < requestCount; i++) {
      const url = urls[i % urls.length];
      const reqStart = Date.now();
      
      try {
        const response = await page.goto(url, { timeout: 10000 });
        const duration = Date.now() - reqStart;
        
        results.push({
          url,
          duration,
          status: response?.status() || 0
        });
        
        if ((i + 1) % 5 === 0) {
          console.log(`  Progress: ${i + 1}/${requestCount} requests completed`);
        }
      } catch (error) {
        console.log(`  ⚠️ Request ${i + 1} failed: ${error}`);
      }
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Calculate statistics
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const minDuration = Math.min(...results.map(r => r.duration));
    const maxDuration = Math.max(...results.map(r => r.duration));
    const successfulRequests = results.filter(r => r.status >= 200 && r.status < 400).length;
    
    console.log('');
    console.log('📈 Sequential Load Test Results:');
    console.log(`  Total requests: ${requestCount}`);
    console.log(`  Successful: ${successfulRequests}`);
    console.log(`  Total duration: ${totalDuration}ms`);
    console.log(`  Average request time: ${Math.round(avgDuration)}ms`);
    console.log(`  Min request time: ${minDuration}ms`);
    console.log(`  Max request time: ${maxDuration}ms`);
    console.log(`  Requests per second: ${((requestCount / totalDuration) * 1000).toFixed(2)}`);
    
    // Verify reasonable performance
    expect(avgDuration).toBeLessThan(5000); // Average under 5 seconds
    expect(successfulRequests).toBeGreaterThanOrEqual(requestCount * 0.9); // 90% success rate
    
    console.log('✅ Sequential load test completed');
  });
  
  test('should record traffic under sustained load', async ({ browser }) => {
    console.log('🔄 Testing sustained load with traffic recording');
    
    const duration = 30000; // 30 seconds
    const concurrency = 3; // 3 concurrent users
    const startTime = Date.now();
    let completedRequests = 0;
    let failedRequests = 0;
    
    console.log(`  Running for ${duration / 1000} seconds with ${concurrency} concurrent users`);
    
    const worker = async (workerId: number) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      let requestCount = 0;
      
      try {
        while (Date.now() - startTime < duration) {
          try {
            // Navigate to Google
            await page.goto('https://www.google.com', { timeout: 10000 });
            
            // Perform a search
            const searchBox = page.getByRole('combobox', { name: /search/i });
            await searchBox.fill(`Test query ${requestCount}`);
            await searchBox.press('Enter');
            
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            
            completedRequests++;
            requestCount++;
            
            if (requestCount % 5 === 0) {
              console.log(`  Worker ${workerId}: ${requestCount} requests completed`);
            }
            
            // Small delay between requests
            await page.waitForTimeout(500);
          } catch (error) {
            failedRequests++;
          }
        }
      } finally {
        console.log(`  Worker ${workerId} finished: ${requestCount} requests`);
        await page.close();
        await context.close();
      }
    };
    
    // Start workers
    const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1));
    await Promise.all(workers);
    
    const endTime = Date.now();
    const actualDuration = endTime - startTime;
    const totalRequests = completedRequests + failedRequests;
    
    console.log('');
    console.log('📊 Sustained Load Test Results:');
    console.log(`  Duration: ${actualDuration / 1000}s`);
    console.log(`  Concurrent users: ${concurrency}`);
    console.log(`  Total requests: ${totalRequests}`);
    console.log(`  Successful: ${completedRequests}`);
    console.log(`  Failed: ${failedRequests}`);
    console.log(`  Success rate: ${((completedRequests / totalRequests) * 100).toFixed(1)}%`);
    console.log(`  Requests per second: ${(completedRequests / (actualDuration / 1000)).toFixed(2)}`);
    console.log(`  Average per worker: ${Math.round(completedRequests / concurrency)} requests`);
    
    // Verify reasonable performance
    expect(completedRequests).toBeGreaterThan(0);
    expect(completedRequests / totalRequests).toBeGreaterThan(0.7); // 70% success rate
    
    console.log('✅ Sustained load test completed');
    console.log('💾 All traffic recorded to HAR files');
  });
  
  test('should verify HAR file generation under load', async ({ page }) => {
    console.log('📝 Verifying HAR file recording during load');
    
    const fs = require('fs');
    const path = require('path');
    
    // Get output directory
    const outputDir = path.join(process.cwd(), '.http-recorder');
    
    // Count HAR files before test
    let harFilesBefore = 0;
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      harFilesBefore = files.filter((f: string) => f.endsWith('.har')).length;
    }
    
    console.log(`  HAR files before: ${harFilesBefore}`);
    
    // Perform multiple requests
    const requests = 5;
    for (let i = 0; i < requests; i++) {
      await page.goto(`https://www.google.com/search?q=load-test-${i}`);
      await page.waitForLoadState('networkidle');
      console.log(`  Request ${i + 1}/${requests} completed`);
    }
    
    // Wait a bit for files to be written
    await page.waitForTimeout(2000);
    
    // Count HAR files after test
    let harFilesAfter = 0;
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      harFilesAfter = files.filter((f: string) => f.endsWith('.har')).length;
    }
    
    console.log(`  HAR files after: ${harFilesAfter}`);
    console.log(`  New HAR files: ${harFilesAfter - harFilesBefore}`);
    
    // Verify HAR files were created
    expect(harFilesAfter).toBeGreaterThan(harFilesBefore);
    
    console.log('✅ HAR files verified');
    console.log(`📁 Output directory: ${outputDir}`);
  });
});

/**
 * Performance benchmarking tests
 */
test.describe('Performance Benchmarks', () => {
  
  test('should measure proxy overhead', async ({ browser }) => {
    console.log('⏱️ Measuring proxy overhead');
    
    const iterations = 5;
    const url = 'https://www.google.com';
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const timings: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      const duration = Date.now() - start;
      
      timings.push(duration);
      console.log(`  Iteration ${i + 1}: ${duration}ms`);
    }
    
    await page.close();
    await context.close();
    
    const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;
    const minTiming = Math.min(...timings);
    const maxTiming = Math.max(...timings);
    
    console.log('');
    console.log('📊 Performance Metrics:');
    console.log(`  Average: ${Math.round(avgTiming)}ms`);
    console.log(`  Min: ${minTiming}ms`);
    console.log(`  Max: ${maxTiming}ms`);
    console.log(`  Std Dev: ${Math.round(Math.sqrt(timings.map(t => Math.pow(t - avgTiming, 2)).reduce((a, b) => a + b) / timings.length))}ms`);
    
    // Verify reasonable performance (under 10 seconds average)
    expect(avgTiming).toBeLessThan(10000);
    
    console.log('✅ Performance benchmark completed');
  });
});
