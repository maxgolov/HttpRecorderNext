/**
 * VS Code Extension Integration Tests
 * 
 * These tests run inside VS Code's Extension Host
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Traffic Recorder Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  suite('Extension Activation', () => {
    test('Extension should be present', () => {
      const extension = vscode.extensions.getExtension('maxgolov.traffic-recorder');
      assert.ok(extension, 'Extension should be installed');
    });

    test('Extension should activate', async () => {
      const extension = vscode.extensions.getExtension('maxgolov.traffic-recorder');
      assert.ok(extension, 'Extension not found');
      
      await extension!.activate();
      assert.strictEqual(extension!.isActive, true, 'Extension should be active');
    });
  });

  suite('Commands', () => {
    test('Should register startProxy command', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('traffic-recorder.startProxy'),
        'startProxy command should be registered'
      );
    });

    test('Should register stopProxy command', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('traffic-recorder.stopProxy'),
        'stopProxy command should be registered'
      );
    });

    test('Should register runTests command', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('traffic-recorder.runTests'),
        'runTests command should be registered'
      );
    });

    test('Should register installDevProxy command', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('traffic-recorder.installDevProxy'),
        'installDevProxy command should be registered'
      );
    });
  });

  suite('Configuration', () => {
    test('Should have default port configuration', () => {
      const config = vscode.workspace.getConfiguration('trafficRecorder');
      const port = config.get<number>('devProxyPort');
      assert.strictEqual(port, 8000, 'Default port should be 8000');
    });

    test('Should have default output directory', () => {
      const config = vscode.workspace.getConfiguration('trafficRecorder');
      const outputDir = config.get<string>('outputDirectory');
      assert.strictEqual(outputDir, './.http-recorder', 'Default output directory should be ./.http-recorder');
    });

    test('Should have autoStart disabled by default', () => {
      const config = vscode.workspace.getConfiguration('trafficRecorder');
      const autoStart = config.get<boolean>('autoStart');
      assert.strictEqual(autoStart, false, 'Auto-start should be disabled by default');
    });
  });

  suite('Workspace Detection', () => {
    test('Should detect workspace structure', () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      assert.ok(workspaceFolders, 'Should have workspace folders');
      assert.ok(workspaceFolders!.length > 0, 'Should have at least one workspace folder');
    });

    test('Should find extension directory', () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      assert.ok(workspaceFolder, 'Should have workspace folder');

      const extensionPath = path.join(
        workspaceFolder!.uri.fsPath,
        'extensions',
        'traffic-recorder'
      );

      const exists = fs.existsSync(extensionPath);
      assert.ok(exists, `Extension directory should exist at ${extensionPath}`);
    });

    test('Should find devproxyrc.json', () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      assert.ok(workspaceFolder, 'Should have workspace folder');

      const configPath = path.join(
        workspaceFolder!.uri.fsPath,
        'extensions',
        'traffic-recorder',
        'devproxyrc.json'
      );

      const exists = fs.existsSync(configPath);
      assert.ok(exists, 'devproxyrc.json should exist');
    });

    test('Should find startup scripts', () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      assert.ok(workspaceFolder, 'Should have workspace folder');

      const scriptsDir = path.join(
        workspaceFolder!.uri.fsPath,
        'extensions',
        'traffic-recorder',
        'scripts'
      );

      const psScript = path.join(scriptsDir, 'start-devproxy.ps1');
      const shScript = path.join(scriptsDir, 'start-devproxy.sh');

      assert.ok(fs.existsSync(psScript), 'PowerShell script should exist');
      assert.ok(fs.existsSync(shScript), 'Bash script should exist');
    });
  });

  suite('HttpRecorder Plugin', () => {
    test('Should find HttpRecorder.DevProxy project', () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      assert.ok(workspaceFolder, 'Should have workspace folder');

      const projectPath = path.join(
        workspaceFolder!.uri.fsPath,
        'DevProxyExtension',
        'HttpRecorder.DevProxy',
        'HttpRecorder.DevProxy.csproj'
      );

      const exists = fs.existsSync(projectPath);
      assert.ok(exists, 'HttpRecorder.DevProxy project should exist');
    });
  });

  suite('Test Files', () => {
    test('Should find example Playwright tests', () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      assert.ok(workspaceFolder, 'Should have workspace folder');

      const testsDir = path.join(
        workspaceFolder!.uri.fsPath,
        'extensions',
        'traffic-recorder',
        'tests'
      );

      const exists = fs.existsSync(testsDir);
      assert.ok(exists, 'Tests directory should exist');

      const testFile = path.join(testsDir, 'google-navigation.spec.ts');
      assert.ok(fs.existsSync(testFile), 'Example test file should exist');
    });

    test('Should find playwright.config.ts', () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      assert.ok(workspaceFolder, 'Should have workspace folder');

      const configPath = path.join(
        workspaceFolder!.uri.fsPath,
        'extensions',
        'traffic-recorder',
        'playwright.config.ts'
      );

      const exists = fs.existsSync(configPath);
      assert.ok(exists, 'playwright.config.ts should exist');
    });
  });
});
