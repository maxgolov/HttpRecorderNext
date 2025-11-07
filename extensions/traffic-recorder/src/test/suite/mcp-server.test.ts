/**
 * MCP Server Integration Tests
 * 
 * Tests for MCP server registration and functionality
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

suite('MCP Server Tests', () => {
  test('Should register MCP server definition provider', async () => {
    const extension = vscode.extensions.getExtension('maxgolov.traffic-cop');
    assert.ok(extension, 'Extension should be installed');

    // Ensure extension is activated
    if (!extension.isActive) {
      await extension.activate();
    }

    // MCP servers are registered via package.json contribution point
    // and vscode.lm.registerMcpServerDefinitionProvider in extension.ts
    // We verify by checking the extension's package.json
    const packageJson = extension.packageJSON;
    assert.ok(packageJson.contributes, 'Extension should have contributions');
    assert.ok(
      packageJson.contributes.mcpServerDefinitionProviders,
      'Extension should contribute MCP server definition providers'
    );

    const mcpProviders = packageJson.contributes.mcpServerDefinitionProviders;
    assert.strictEqual(Array.isArray(mcpProviders), true, 'MCP providers should be an array');
    assert.strictEqual(mcpProviders.length, 1, 'Should have exactly one MCP provider');
    assert.strictEqual(mcpProviders[0].id, 'trafficCopMcp', 'MCP provider ID should be trafficCopMcp');
    assert.strictEqual(
      mcpProviders[0].label,
      'Traffic Cop - HAR Analysis',
      'MCP provider label should be correct'
    );
  });

  test('Should bundle MCP server code', () => {
    const extension = vscode.extensions.getExtension('maxgolov.traffic-cop');
    assert.ok(extension, 'Extension should be installed');

    const mcpServerPath = path.join(extension.extensionPath, 'dist', 'mcp', 'server.js');
    const exists = fs.existsSync(mcpServerPath);
    assert.strictEqual(exists, true, `MCP server should be bundled at ${mcpServerPath}`);
  });

  test('MCP server bundle should use CommonJS format', () => {
    const extension = vscode.extensions.getExtension('maxgolov.traffic-cop');
    assert.ok(extension, 'Extension should be installed');

    const mcpServerPath = path.join(extension.extensionPath, 'dist', 'mcp', 'server.js');
    const content = fs.readFileSync(mcpServerPath, 'utf8');

    // Check for CommonJS patterns (exports, require)
    // Should NOT have ES module error patterns
    assert.ok(!content.includes('module is not defined'), 'Should not have ES module errors');
    
    // CommonJS uses require() and module.exports
    // The bundled file should have these patterns
    const hasCommonJSPatterns = 
      content.includes('module.exports') || 
      content.includes('exports.') ||
      content.includes('require(');
    
    assert.ok(
      hasCommonJSPatterns,
      'MCP server should use CommonJS format (module.exports/require)'
    );
  });

  test('Should provide MCP server configuration', async () => {
    const extension = vscode.extensions.getExtension('maxgolov.traffic-cop');
    assert.ok(extension, 'Extension should be installed');

    if (!extension.isActive) {
      await extension.activate();
    }

    // Verify extension path is accessible for server.js location
    const extensionPath = extension.extensionPath;
    assert.ok(extensionPath, 'Extension path should be available');
    
    const distPath = path.join(extensionPath, 'dist');
    assert.ok(fs.existsSync(distPath), 'dist folder should exist');

    const mcpPath = path.join(distPath, 'mcp');
    assert.ok(fs.existsSync(mcpPath), 'dist/mcp folder should exist');

    const serverPath = path.join(mcpPath, 'server.js');
    assert.ok(fs.existsSync(serverPath), 'MCP server.js should exist');
  });

  test('MCP server should have recordings directory configuration', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, 'Should have workspace folder');

    const config = vscode.workspace.getConfiguration('trafficRecorder');
    const outputDir = config.get<string>('outputDirectory', './.http-recorder');
    
    // The recordings directory will be created when proxy runs
    // We just verify the configuration is accessible
    assert.ok(outputDir, 'Output directory configuration should be set');
    assert.strictEqual(
      typeof outputDir,
      'string',
      'Output directory should be a string'
    );
  });

  test('MCP server should use Node.js runtime', () => {
    // MCP server is configured to run with process.execPath (Node.js)
    // This verifies the runtime environment is correct
    const nodeVersion = process.version;
    assert.ok(nodeVersion, 'Node.js should be available');
    assert.ok(nodeVersion.startsWith('v'), 'Node version should start with v');
    
    // Extension requires Node >= 20.0.0
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0], 10);
    assert.ok(majorVersion >= 20, `Node.js version should be >= 20 (current: ${nodeVersion})`);
  });
});
