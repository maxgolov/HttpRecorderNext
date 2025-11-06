/**
 * Specific JavaScript/TypeScript framework detectors
 */

import * as vscode from 'vscode';
import { JavaScriptFrameworkDetector } from './JavaScriptFrameworkDetector';

export class PlaywrightDetector extends JavaScriptFrameworkDetector {
  readonly name = 'Playwright';
  readonly icon = '🎭';
  readonly supportsProxy = true;
  
  protected readonly configFileNames = [
    'playwright.config.ts',
    'playwright.config.js',
    'playwright.config.mjs'
  ];
  
  protected readonly dependencyNames = ['@playwright/test', 'playwright'];
  protected readonly testFilePatterns = ['**/*.spec.{ts,js,mjs}', '**/*.test.{ts,js}'];
  
  getTestCommand(): string {
    return 'npx playwright test';
  }
  
  protected async detectFrameworkSpecificIndicators(
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<string[]> {
    const evidence: string[] = [];
    
    // Check for Playwright-specific imports in test files
    const testFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/*.spec.{ts,js}'),
      '**/node_modules/**',
      3
    );
    
    for (const file of testFiles) {
      try {
        const content = await vscode.workspace.fs.readFile(file);
        const text = Buffer.from(content).toString('utf8').substring(0, 500);
        
        if (text.includes('@playwright/test') || text.includes('import { test, expect }')) {
          evidence.push('Found Playwright imports in test files');
          break;
        }
      } catch (error) {
        // Ignore read errors
      }
    }
    
    return evidence;
  }
}

export class JestDetector extends JavaScriptFrameworkDetector {
  readonly name = 'Jest';
  readonly icon = '🃏';
  readonly supportsProxy = true;
  
  protected readonly configFileNames = [
    'jest.config.js',
    'jest.config.ts',
    'jest.config.cjs',
    'jest.config.mjs',
    'jest.config.json'
  ];
  
  protected readonly dependencyNames = ['jest', '@jest/core'];
  protected readonly testFilePatterns = [
    '**/*.test.{js,ts,jsx,tsx}',
    '**/*.spec.{js,ts,jsx,tsx}',
    '**/__tests__/**/*.{js,ts,jsx,tsx}'
  ];
  
  getTestCommand(): string {
    return 'npm test';
  }
}

export class VitestDetector extends JavaScriptFrameworkDetector {
  readonly name = 'Vitest';
  readonly icon = '⚡';
  readonly supportsProxy = true;
  
  protected readonly configFileNames = [
    'vitest.config.ts',
    'vitest.config.js',
    'vite.config.ts',
    'vite.config.js'
  ];
  
  protected readonly dependencyNames = ['vitest'];
  protected readonly testFilePatterns = [
    '**/*.test.{js,ts,jsx,tsx}',
    '**/*.spec.{js,ts,jsx,tsx}'
  ];
  
  getTestCommand(): string {
    return 'npx vitest run';
  }
  
  protected async detectFrameworkSpecificIndicators(
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<string[]> {
    const evidence: string[] = [];
    
    // Check if vite.config has test section
    const viteConfigs = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/vite.config.{ts,js}'),
      '**/node_modules/**',
      5
    );
    
    for (const file of viteConfigs) {
      try {
        const content = await vscode.workspace.fs.readFile(file);
        const text = Buffer.from(content).toString('utf8');
        
        if (text.includes('test:') || text.includes('vitest')) {
          evidence.push('Found Vitest configuration in vite.config');
          break;
        }
      } catch (error) {
        // Ignore
      }
    }
    
    return evidence;
  }
}

export class CypressDetector extends JavaScriptFrameworkDetector {
  readonly name = 'Cypress';
  readonly icon = '🌲';
  readonly supportsProxy = true;
  
  protected readonly configFileNames = [
    'cypress.config.ts',
    'cypress.config.js',
    'cypress.json'
  ];
  
  protected readonly dependencyNames = ['cypress'];
  protected readonly testFilePatterns = [
    '**/cypress/**/*.cy.{js,ts}',
    '**/cypress/e2e/**/*.{js,ts}',
    '**/cypress/integration/**/*.{js,ts}'
  ];
  
  getTestCommand(): string {
    return 'npx cypress run';
  }
}

export class MochaDetector extends JavaScriptFrameworkDetector {
  readonly name = 'Mocha';
  readonly icon = '☕';
  readonly supportsProxy = true;
  
  protected readonly configFileNames = [
    '.mocharc.js',
    '.mocharc.json',
    '.mocharc.yaml',
    '.mocharc.yml',
    'mocha.opts'
  ];
  
  protected readonly dependencyNames = ['mocha'];
  protected readonly testFilePatterns = [
    '**/test/**/*.{js,ts}',
    '**/*.test.{js,ts}',
    '**/*.spec.{js,ts}'
  ];
  
  getTestCommand(): string {
    return 'npm test';
  }
}

export class JasmineDetector extends JavaScriptFrameworkDetector {
  readonly name = 'Jasmine';
  readonly icon = '🌸';
  readonly supportsProxy = true;
  
  protected readonly configFileNames = [
    'jasmine.json',
    'spec/support/jasmine.json'
  ];
  
  protected readonly dependencyNames = ['jasmine', 'jasmine-core'];
  protected readonly testFilePatterns = [
    '**/*.spec.{js,ts}',
    '**/spec/**/*.{js,ts}'
  ];
  
  getTestCommand(): string {
    return 'npm test';
  }
}

export class TestCafeDetector extends JavaScriptFrameworkDetector {
  readonly name = 'TestCafe';
  readonly icon = '🧪';
  readonly supportsProxy = true;
  
  protected readonly configFileNames = [
    '.testcaferc.json',
    'testcafe.json'
  ];
  
  protected readonly dependencyNames = ['testcafe'];
  protected readonly testFilePatterns = [
    '**/tests/**/*.{js,ts}',
    '**/*.test.{js,ts}'
  ];
  
  getTestCommand(): string {
    return 'npx testcafe';
  }
}
