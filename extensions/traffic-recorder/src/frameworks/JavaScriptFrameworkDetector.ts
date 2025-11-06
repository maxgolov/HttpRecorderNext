/**
 * Base detector for JavaScript/TypeScript frameworks
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { DetectionResult, FrameworkDetector } from './types';

export abstract class JavaScriptFrameworkDetector extends FrameworkDetector {
  readonly language = 'JavaScript/TypeScript';
  
  protected abstract readonly configFileNames: string[];
  protected abstract readonly dependencyNames: string[];
  protected abstract readonly testFilePatterns: string[];
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let version: string | undefined;
    let command: string | undefined;
    let workingDirectory: string | undefined;
    
    // Check package.json for dependencies
    const packageJson = await this.readPackageJson(workspaceFolder);
    if (packageJson) {
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies
      };
      
      for (const depName of this.dependencyNames) {
        if (deps[depName]) {
          evidence.push(`Found ${depName} in package.json`);
          version = deps[depName];
          confidence = 'high';
        }
      }
      
      // Check test script
      if (packageJson.scripts?.test) {
        const testScript = packageJson.scripts.test;
        for (const depName of this.dependencyNames) {
          if (testScript.includes(depName)) {
            evidence.push(`${depName} found in package.json test script`);
            command = testScript;
            confidence = 'high';
          }
        }
      }
      
      workingDirectory = path.dirname(path.join(workspaceFolder.uri.fsPath, 'package.json'));
    }
    
    // Check for configuration files
    for (const configFile of this.configFileNames) {
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, `**/${configFile}`),
        '**/node_modules/**',
        5
      );
      
      if (files.length > 0) {
        evidence.push(`Found ${configFile}`);
        configFiles.push(...files.map(f => f.fsPath));
        confidence = 'high';
        if (!workingDirectory) {
          workingDirectory = path.dirname(files[0].fsPath);
        }
      }
    }
    
    // Check for test files
    for (const pattern of this.testFilePatterns) {
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, pattern),
        '**/node_modules/**',
        5
      );
      
      if (files.length > 0) {
        evidence.push(`Found ${files.length} test file(s) matching ${pattern}`);
        if (confidence === 'low') {
          confidence = 'medium';
        }
      }
    }
    
    // Framework-specific indicators
    const specificEvidence = await this.detectFrameworkSpecificIndicators(workspaceFolder);
    evidence.push(...specificEvidence);
    
    // Only detect if we have high confidence (dependencies or config files found)
    // Test file patterns alone are not sufficient (too many false positives)
    return {
      detected: confidence === 'high',
      confidence,
      evidence,
      configFiles,
      version,
      workingDirectory: workingDirectory || workspaceFolder.uri.fsPath,
      command: command || this.getTestCommand()
    };
  }
  
  protected async readPackageJson(workspaceFolder: vscode.WorkspaceFolder): Promise<any | null> {
    try {
      const packageJsonFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, '**/package.json'),
        '**/node_modules/**',
        10
      );
      
      if (packageJsonFiles.length === 0) {
        return null;
      }
      
      // Use the first package.json found (typically root)
      const content = await vscode.workspace.fs.readFile(packageJsonFiles[0]);
      return JSON.parse(Buffer.from(content).toString('utf8'));
    } catch (error) {
      return null;
    }
  }
  
  protected async detectFrameworkSpecificIndicators(
    _workspaceFolder: vscode.WorkspaceFolder
  ): Promise<string[]> {
    // Override in subclasses for framework-specific detection
    return [];
  }
}
