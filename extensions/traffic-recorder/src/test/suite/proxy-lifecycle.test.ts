/**
 * Dev Proxy Lifecycle E2E Tests
 * 
 * Tests for Start/Stop proxy functionality
 * 
 * NOTE: These tests require Dev Proxy to be installed and are skipped in CI
 */

import * as assert from 'assert';
import * as http from 'http';
import * as vscode from 'vscode';

// Skip these tests in CI environment (they require Dev Proxy installation)
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const describeOrSkip = isCI ? suite.skip : suite;

describeOrSkip('Dev Proxy Lifecycle Tests', () => {
  const API_PORT = 8897;
  const API_HOST = '127.0.0.1';

  /**
   * Check if Dev Proxy API is responding
   */
  async function isProxyRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://${API_HOST}:${API_PORT}/proxy`, (res) => {
        res.resume(); // Consume response data
        resolve(res.statusCode === 200);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Wait for proxy to reach expected state
   */
  async function waitForProxyState(expectedRunning: boolean, timeoutMs = 10000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const running = await isProxyRunning();
      if (running === expectedRunning) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  test('Should start Dev Proxy successfully', async function() {
    this.timeout(30000); // 30 seconds for proxy startup

    // Stop proxy if already running
    const wasRunning = await isProxyRunning();
    if (wasRunning) {
      await vscode.commands.executeCommand('traffic-recorder.stopProxy');
      await waitForProxyState(false, 5000);
    }

    // Start proxy
    await vscode.commands.executeCommand('traffic-recorder.startProxy');

    // Wait for proxy to be ready
    const started = await waitForProxyState(true, 20000);
    assert.strictEqual(started, true, 'Dev Proxy should start and respond on API port 8897');

    // Verify API responds
    const running = await isProxyRunning();
    assert.strictEqual(running, true, 'Dev Proxy API should be accessible at http://127.0.0.1:8897/proxy');
  });

  test('Should stop Dev Proxy successfully', async function() {
    this.timeout(15000); // 15 seconds

    // Ensure proxy is running first
    const wasRunning = await isProxyRunning();
    if (!wasRunning) {
      await vscode.commands.executeCommand('traffic-recorder.startProxy');
      await waitForProxyState(true, 20000);
    }

    // Stop proxy
    await vscode.commands.executeCommand('traffic-recorder.stopProxy');

    // Wait for proxy to stop
    const stopped = await waitForProxyState(false, 10000);
    assert.strictEqual(stopped, true, 'Dev Proxy should stop');

    // Verify API no longer responds
    const running = await isProxyRunning();
    assert.strictEqual(running, false, 'Dev Proxy API should not be accessible after stop');
  });

  test('Should restart Dev Proxy', async function() {
    this.timeout(45000); // 45 seconds

    // Ensure proxy is running
    let running = await isProxyRunning();
    if (!running) {
      await vscode.commands.executeCommand('traffic-recorder.startProxy');
      await waitForProxyState(true, 20000);
    }

    // Stop
    await vscode.commands.executeCommand('traffic-recorder.stopProxy');
    await waitForProxyState(false, 10000);

    running = await isProxyRunning();
    assert.strictEqual(running, false, 'Proxy should be stopped');

    // Start again
    await vscode.commands.executeCommand('traffic-recorder.startProxy');
    await waitForProxyState(true, 20000);

    running = await isProxyRunning();
    assert.strictEqual(running, true, 'Proxy should restart successfully');
  });

  test('Should use correct API port (8897, not 8080)', async function() {
    this.timeout(30000);

    // Ensure proxy is running
    const wasRunning = await isProxyRunning();
    if (!wasRunning) {
      await vscode.commands.executeCommand('traffic-recorder.startProxy');
      await waitForProxyState(true, 20000);
    }

    // Verify API is on 8897
    const apiResponds = await isProxyRunning();
    assert.strictEqual(apiResponds, true, 'API should respond on port 8897');

    // Verify proxy port 8080 is different (can't test proxy directly without making requests through it)
    // But we can verify the API port is explicitly 8897
    const req = http.get(`http://${API_HOST}:${API_PORT}/proxy`, (res) => {
      assert.strictEqual(res.statusCode, 200, 'API endpoint should return 200 on port 8897');
      res.resume();
    });

    await new Promise((resolve, reject) => {
      req.on('error', reject);
      req.on('close', resolve);
    });
  });

  // Cleanup: ensure proxy is stopped after all tests
  suiteTeardown(async function() {
    this.timeout(10000);
    const running = await isProxyRunning();
    if (running) {
      await vscode.commands.executeCommand('traffic-recorder.stopProxy');
      await waitForProxyState(false, 5000);
    }
  });
});
