/**
 * Framework detectors for Java, C#, Go, Ruby, PHP, Swift, Kotlin
 */

import * as vscode from 'vscode';
import { DetectionResult, FrameworkDetector } from './types';

// ==================== JVM (Java/Kotlin) ====================

export abstract class JVMFrameworkDetector extends FrameworkDetector {
  protected async readFile(uri: vscode.Uri): Promise<string | null> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf8');
    } catch (error) {
      return null;
    }
  }
}

export class JUnitDetector extends JVMFrameworkDetector {
  readonly name = 'JUnit';
  readonly language = 'Java';
  readonly icon = '☕';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for pom.xml (Maven)
    const pomFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/pom.xml'),
      '**/node_modules/**',
      5
    );
    
    for (const file of pomFiles) {
      const content = await this.readFile(file);
      if (content && (content.includes('junit') || content.includes('junit-jupiter'))) {
        evidence.push('Found JUnit in pom.xml');
        configFiles.push(file.fsPath);
        confidence = 'high';
      }
    }
    
    // Check for build.gradle (Gradle)
    const gradleFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/build.gradle*'),
      '**/node_modules/**',
      5
    );
    
    for (const file of gradleFiles) {
      const content = await this.readFile(file);
      if (content && content.includes('junit')) {
        evidence.push('Found JUnit in build.gradle');
        configFiles.push(file.fsPath);
        confidence = 'high';
      }
    }
    
    // Check for test files
    const testFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/src/test/java/**/*Test.java'),
      '**/node_modules/**',
      5
    );
    
    if (testFiles.length > 0) {
      evidence.push(`Found ${testFiles.length} JUnit test file(s)`);
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
    return 'mvn test'; // or 'gradle test'
  }
}

export class TestNGDetector extends JVMFrameworkDetector {
  readonly name = 'TestNG';
  readonly language = 'Java';
  readonly icon = '☕';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for testng.xml
    const testngXmlFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/testng.xml'),
      '**/node_modules/**',
      5
    );
    
    if (testngXmlFiles.length > 0) {
      evidence.push('Found testng.xml');
      configFiles.push(...testngXmlFiles.map(f => f.fsPath));
      confidence = 'high';
    }
    
    // Check build files
    const pomFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/pom.xml'),
      '**/node_modules/**',
      5
    );
    
    for (const file of pomFiles) {
      const content = await this.readFile(file);
      if (content && content.includes('testng')) {
        evidence.push('Found TestNG in pom.xml');
        configFiles.push(file.fsPath);
        confidence = 'high';
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
    return 'mvn test';
  }
}

export class KotestDetector extends JVMFrameworkDetector {
  readonly name = 'Kotest';
  readonly language = 'Kotlin';
  readonly icon = '🎯';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for build.gradle.kts
    const gradleFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/build.gradle.kts'),
      '**/node_modules/**',
      5
    );
    
    for (const file of gradleFiles) {
      const content = await this.readFile(file);
      if (content && content.includes('kotest')) {
        evidence.push('Found Kotest in build.gradle.kts');
        configFiles.push(file.fsPath);
        confidence = 'high';
      }
    }
    
    // Check for test files
    const testFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/src/**/Test.kt'),
      '**/node_modules/**',
      5
    );
    
    if (testFiles.length > 0) {
      evidence.push(`Found ${testFiles.length} Kotlin test file(s)`);
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
    return 'gradle test';
  }
}

// ==================== C# (.NET) ====================

export abstract class DotNetFrameworkDetector extends FrameworkDetector {
  readonly language = 'C#';
  
  protected async readFile(uri: vscode.Uri): Promise<string | null> {
    try {
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf8');
    } catch (error) {
      return null;
    }
  }
}

export class NUnitDetector extends DotNetFrameworkDetector {
  readonly name = 'NUnit';
  readonly icon = '🔷';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for .csproj files with NUnit references
    const csprojFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/*.csproj'),
      '**/node_modules/**',
      10
    );
    
    for (const file of csprojFiles) {
      const content = await this.readFile(file);
      if (content && content.includes('NUnit')) {
        evidence.push('Found NUnit in .csproj');
        configFiles.push(file.fsPath);
        confidence = 'high';
      }
    }
    
    // Check for test files
    const testFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/*Test.cs'),
      '**/node_modules/**',
      5
    );
    
    if (testFiles.length > 0) {
      evidence.push(`Found ${testFiles.length} test file(s)`);
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
    return 'dotnet test';
  }
}

export class XUnitDetector extends DotNetFrameworkDetector {
  readonly name = 'xUnit';
  readonly icon = '🔷';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for .csproj files with xUnit references
    const csprojFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/*.csproj'),
      '**/node_modules/**',
      10
    );
    
    for (const file of csprojFiles) {
      const content = await this.readFile(file);
      if (content && (content.includes('xunit') || content.includes('xUnit'))) {
        evidence.push('Found xUnit in .csproj');
        configFiles.push(file.fsPath);
        confidence = 'high';
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
    return 'dotnet test';
  }
}

// ==================== Ruby ====================

export class RSpecDetector extends FrameworkDetector {
  readonly name = 'RSpec';
  readonly language = 'Ruby';
  readonly icon = '💎';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for .rspec or spec_helper.rb
    const rspecFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/.rspec'),
      '**/node_modules/**',
      5
    );
    
    if (rspecFiles.length > 0) {
      evidence.push('Found .rspec file');
      configFiles.push(...rspecFiles.map(f => f.fsPath));
      confidence = 'high';
    }
    
    // Check for spec directory
    const specFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/spec/**/*_spec.rb'),
      '**/node_modules/**',
      5
    );
    
    if (specFiles.length > 0) {
      evidence.push(`Found ${specFiles.length} RSpec test file(s)`);
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
    return 'rspec';
  }
}

// ==================== PHP ====================

export class PHPUnitDetector extends FrameworkDetector {
  readonly name = 'PHPUnit';
  readonly language = 'PHP';
  readonly icon = '🐘';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for phpunit.xml
    const phpunitXmlFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/phpunit.xml*'),
      '**/node_modules/**',
      5
    );
    
    if (phpunitXmlFiles.length > 0) {
      evidence.push('Found phpunit.xml');
      configFiles.push(...phpunitXmlFiles.map(f => f.fsPath));
      confidence = 'high';
    }
    
    // Check for test files
    const testFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/tests/**/*Test.php'),
      '**/node_modules/**',
      5
    );
    
    if (testFiles.length > 0) {
      evidence.push(`Found ${testFiles.length} PHPUnit test file(s)`);
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
    return 'phpunit';
  }
}

// ==================== Go ====================

export class GoTestDetector extends FrameworkDetector {
  readonly name = 'Go test';
  readonly language = 'Go';
  readonly icon = '🐹';
  readonly supportsProxy = true;
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for go.mod
    const goModFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/go.mod'),
      '**/node_modules/**',
      5
    );
    
    if (goModFiles.length > 0) {
      evidence.push('Found go.mod');
      configFiles.push(...goModFiles.map(f => f.fsPath));
    }
    
    // Check for test files
    const testFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/*_test.go'),
      '**/node_modules/**',
      5
    );
    
    if (testFiles.length > 0) {
      evidence.push(`Found ${testFiles.length} Go test file(s)`);
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
    return 'go test ./...';
  }
}

// ==================== Swift ====================

export class XCTestDetector extends FrameworkDetector {
  readonly name = 'XCTest';
  readonly language = 'Swift';
  readonly icon = '🍎';
  readonly supportsProxy = false; // XCTest is tightly integrated with Xcode
  
  async detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configFiles: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    // Check for .xcodeproj or .xcworkspace
    const xcodeProjects = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/*.{xcodeproj,xcworkspace}'),
      '**/node_modules/**',
      5
    );
    
    if (xcodeProjects.length > 0) {
      evidence.push('Found Xcode project');
      configFiles.push(...xcodeProjects.map(f => f.fsPath));
    }
    
    // Check for test files
    const testFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/*Tests.swift'),
      '**/node_modules/**',
      5
    );
    
    if (testFiles.length > 0) {
      evidence.push(`Found ${testFiles.length} XCTest file(s)`);
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
    return 'swift test';
  }
}
