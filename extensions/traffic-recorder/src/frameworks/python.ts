/**
 * Python framework detectors
 */

import * as vscode from 'vscode';
import { DetectionResult, FrameworkDetector } from './types';

export abstract class PythonFrameworkDetector extends FrameworkDetector {
  readonly language = 'Python';
  
  protected async findPyprojectToml(workspaceFolder: vscode.WorkspaceFolder): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/pyproject.toml'),
      '**/{node_modules,.venv,venv,env}/**',
      10
    );
  }
  
  protected async readFile(uri: vscode.Uri): Promise<string | null> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf8');
    } catch (error) {
      return null;
    }
  }
}

export class PytestDetector extends PythonFrameworkDetector {
  readonly name = 'pytest';
  readonly icon = '🐍';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for pytest.ini
    const pytestIniFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/pytest.ini'),
      '**/{node_modules,.venv,venv,env}/**',
      5
    );
    
    if (pytestIniFiles.length > 0) {
      evidence.push('Found pytest.ini');
      configFiles.push(...pytestIniFiles.map(f => f.fsPath));
      confidence = 'high';
    }
    
    // Check pyproject.toml for [tool.pytest]
    const pyprojectFiles = await this.findPyprojectToml(workspaceFolder);
    for (const file of pyprojectFiles) {
      const content = await this.readFile(file);
      if (content && content.includes('[tool.pytest')) {
        evidence.push('Found [tool.pytest] in pyproject.toml');
        configFiles.push(file.fsPath);
        confidence = 'high';
      }
    }
    
    // Check for setup.cfg with [tool:pytest]
    const setupCfgFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/setup.cfg'),
      '**/{node_modules,.venv,venv,env}/**',
      5
    );
    
    for (const file of setupCfgFiles) {
      const content = await this.readFile(file);
      if (content && content.includes('[tool:pytest]')) {
        evidence.push('Found [tool:pytest] in setup.cfg');
        configFiles.push(file.fsPath);
        confidence = 'high';
      }
    }
    
    // Check for test files
    const testFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/test_*.py'),
      '**/{node_modules,.venv,venv,env}/**',
      5
    );
    
    if (testFiles.length > 0) {
      evidence.push(`Found ${testFiles.length} pytest test file(s)`);
      if (confidence === 'low') {
        confidence = 'medium';
      }
    }
    
    return {
      detected: evidence.length > 0,
      confidence,
      evidence,
      configFiles,
      workingDirectory: workspaceFolder.uri.fsPath,
      command: this.getTestCommand()
    };
  }
  
  getTestCommand(): string {
    return 'pytest';
  }
}

export class UnittestDetector extends PythonFrameworkDetector {
  readonly name = 'unittest';
  readonly icon = '🐍';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for test files with unittest imports
    const testFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/test_*.py'),
      '**/{node_modules,.venv,venv,env}/**',
      10
    );
    
    for (const file of testFiles) {
      const content = await this.readFile(file);
      if (content && content.includes('import unittest')) {
        evidence.push('Found unittest imports in test files');
        confidence = 'high';
        break;
      }
    }
    
    if (testFiles.length > 0 && confidence === 'low') {
      evidence.push(`Found ${testFiles.length} potential unittest file(s)`);
      confidence = 'medium';
    }
    
    return {
      detected: evidence.length > 0,
      confidence,
      evidence,
      configFiles,
      workingDirectory: workspaceFolder.uri.fsPath,
      command: this.getTestCommand()
    };
  }
  
  getTestCommand(): string {
    return 'python -m unittest discover';
  }
}

export class RobotFrameworkDetector extends PythonFrameworkDetector {
  readonly name = 'Robot Framework';
  readonly icon = '🤖';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for .robot files
    const robotFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/*.robot'),
      '**/{node_modules,.venv,venv,env}/**',
      5
    );
    
    if (robotFiles.length > 0) {
      evidence.push(`Found ${robotFiles.length} .robot file(s)`);
      configFiles.push(...robotFiles.map(f => f.fsPath));
      confidence = 'high';
    }
    
    // Check for robot.yaml or robot.yml config
    const robotConfigFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/robot.{yaml,yml}'),
      '**/{node_modules,.venv,venv,env}/**',
      5
    );
    
    if (robotConfigFiles.length > 0) {
      evidence.push('Found robot configuration file');
      configFiles.push(...robotConfigFiles.map(f => f.fsPath));
      confidence = 'high';
    }
    
    return {
      detected: evidence.length > 0,
      confidence,
      evidence,
      configFiles,
      workingDirectory: workspaceFolder.uri.fsPath,
      command: this.getTestCommand()
    };
  }
  
  getTestCommand(): string {
    return 'robot';
  }
}
