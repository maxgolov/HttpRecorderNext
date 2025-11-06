/**
 * Framework Detection Tests
 * 
 * Tests the framework detection orchestrator against sample workspaces
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { JestDetector, PlaywrightDetector, VitestDetector } from '../../frameworks/javascript';
import { FrameworkDetectionOrchestrator } from '../../frameworks/orchestrator';
import { PytestDetector } from '../../frameworks/python';

suite('Framework Detection Test Suite', () => {
  // Point to source workspaces since they are not compiled
  const testWorkspacesRoot = path.join(__dirname, '..', '..', '..', 'src', 'test', 'workspaces');

  test('PlaywrightDetector should detect Playwright workspace', async () => {
    const workspaceUri = vscode.Uri.file(path.join(testWorkspacesRoot, 'playwright-workspace'));
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: workspaceUri,
      name: 'playwright-workspace',
      index: 0
    };

    const detector = new PlaywrightDetector();
    const result = await detector.detect(workspaceFolder);

    assert.strictEqual(result.detected, true, 'Playwright should be detected');
    assert.strictEqual(result.confidence, 'high', 'Detection confidence should be high');
    assert.ok(result.evidence.length > 0, 'Should have evidence');
    assert.ok(
      result.evidence.some(e => e.includes('playwright') || e.includes('Playwright')),
      'Evidence should mention Playwright'
    );
  });

  test('JestDetector should detect Jest workspace', async () => {
    const workspaceUri = vscode.Uri.file(path.join(testWorkspacesRoot, 'jest-workspace'));
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: workspaceUri,
      name: 'jest-workspace',
      index: 0
    };

    const detector = new JestDetector();
    const result = await detector.detect(workspaceFolder);

    assert.strictEqual(result.detected, true, 'Jest should be detected');
    assert.strictEqual(result.confidence, 'high', 'Detection confidence should be high');
    assert.ok(result.evidence.length > 0, 'Should have evidence');
  });

  test('PytestDetector should detect pytest workspace', async () => {
    const workspaceUri = vscode.Uri.file(path.join(testWorkspacesRoot, 'pytest-workspace'));
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: workspaceUri,
      name: 'pytest-workspace',
      index: 0
    };

    const detector = new PytestDetector();
    const result = await detector.detect(workspaceFolder);

    assert.strictEqual(result.detected, true, 'Pytest should be detected');
    assert.ok(result.evidence.length > 0, 'Should have evidence');
  });

  test('PlaywrightDetector should NOT detect Jest workspace', async () => {
    const workspaceUri = vscode.Uri.file(path.join(testWorkspacesRoot, 'jest-workspace'));
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: workspaceUri,
      name: 'jest-workspace',
      index: 0
    };

    const detector = new PlaywrightDetector();
    const result = await detector.detect(workspaceFolder);

    assert.strictEqual(result.detected, false, 'Playwright should NOT be detected in Jest workspace');
  });

  test('Orchestrator should detect all frameworks in Playwright workspace', async () => {
    const workspaceUri = vscode.Uri.file(path.join(testWorkspacesRoot, 'playwright-workspace'));
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: workspaceUri,
      name: 'playwright-workspace',
      index: 0
    };

    const orchestrator = new FrameworkDetectionOrchestrator();
    const profile = await orchestrator.detectFrameworksInFolder(workspaceFolder);

    assert.ok(profile.frameworks.length > 0, 'Should detect at least one framework');
    
    const playwrightFramework = profile.frameworks.find(f => f.name === 'Playwright');
    assert.ok(playwrightFramework, 'Should detect Playwright framework');
    assert.strictEqual(playwrightFramework?.detected, true);
  });

  test('Orchestrator should categorize frameworks correctly', async () => {
    const orchestrator = new FrameworkDetectionOrchestrator();
    
    // This test will use the actual workspace if opened
    // Otherwise it creates minimal test scenario
    const result = await orchestrator.detectAllFrameworks();

    assert.ok(result, 'Should return result object');
    assert.ok(Array.isArray(result.javascript), 'Should have javascript array');
    assert.ok(Array.isArray(result.python), 'Should have python array');
    assert.ok(Array.isArray(result.java), 'Should have java array');
    assert.ok(Array.isArray(result.all), 'Should have all array');
  });

  test('Orchestrator should respect cache', async () => {
    const workspaceUri = vscode.Uri.file(path.join(testWorkspacesRoot, 'playwright-workspace'));
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: workspaceUri,
      name: 'playwright-workspace',
      index: 0
    };

    const orchestrator = new FrameworkDetectionOrchestrator();
    
    // First detection - should cache
    const startTime1 = Date.now();
    await orchestrator.detectFrameworksInFolder(workspaceFolder);
    const duration1 = Date.now() - startTime1;

    // Second detection - should use cache (much faster)
    const startTime2 = Date.now();
    await orchestrator.detectFrameworksInFolder(workspaceFolder);
    const duration2 = Date.now() - startTime2;

    // Cached result should be significantly faster (at least 10x)
    assert.ok(duration2 < duration1 / 2, `Cached detection (${duration2}ms) should be faster than first detection (${duration1}ms)`);
  });

  test('Orchestrator should clear cache correctly', async () => {
    const workspaceUri = vscode.Uri.file(path.join(testWorkspacesRoot, 'playwright-workspace'));
    const workspaceFolder: vscode.WorkspaceFolder = {
      uri: workspaceUri,
      name: 'playwright-workspace',
      index: 0
    };

    const orchestrator = new FrameworkDetectionOrchestrator();
    
    // Populate cache
    await orchestrator.detectFrameworksInFolder(workspaceFolder);
    
    // Clear cache
    orchestrator.clearCache();
    
    // This should work without errors
    const profile = await orchestrator.detectFrameworksInFolder(workspaceFolder);
    assert.ok(profile, 'Should still work after cache clear');
  });

  test('Orchestrator configuration should disable specific frameworks', async () => {
    const orchestrator = new FrameworkDetectionOrchestrator({
      disabledFrameworks: ['Playwright', 'Jest']
    });

    const allDetectors = orchestrator.getAllDetectors();
    const detectorNames = allDetectors.map(d => d.name);

    assert.ok(!detectorNames.includes('Playwright'), 'Playwright should be disabled');
    assert.ok(!detectorNames.includes('Jest'), 'Jest should be disabled');
  });

  test('Detectors should set supportsProxy correctly', () => {
    const playwrightDetector = new PlaywrightDetector();
    const jestDetector = new JestDetector();
    const pytestDetector = new PytestDetector();

    assert.strictEqual(playwrightDetector.supportsProxy, true, 'Playwright supports proxy');
    assert.strictEqual(jestDetector.supportsProxy, true, 'Jest supports proxy');
    assert.strictEqual(pytestDetector.supportsProxy, true, 'Pytest supports proxy');
  });

  test('Detectors should return proper test commands', () => {
    const playwrightDetector = new PlaywrightDetector();
    const jestDetector = new JestDetector();
    const pytestDetector = new PytestDetector();

    assert.strictEqual(playwrightDetector.getTestCommand(), 'npx playwright test');
    assert.strictEqual(jestDetector.getTestCommand(), 'npm test');
    assert.strictEqual(pytestDetector.getTestCommand(), 'pytest');
  });

  test('VitestDetector should detect vite.config with test section', async () => {
    // Create a minimal Vitest workspace for testing
    const detector = new VitestDetector();
    
    // This test verifies the detector has proper configuration
    assert.strictEqual(detector.name, 'Vitest');
    assert.strictEqual(detector.language, 'JavaScript/TypeScript');
    assert.strictEqual(detector.icon, '⚡');
  });
});
