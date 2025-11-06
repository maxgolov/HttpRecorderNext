/**
 * Framework detection orchestrator
 * Coordinates all framework detectors and manages caching
 */

import * as vscode from 'vscode';
import { CacheEntry, DiscoveredTestFrameworks, FolderFrameworkProfile, FrameworkDetectionConfig, FrameworkDetector, TestFrameworkInfo } from './types';

// Import all detectors
import { CypressDetector, JasmineDetector, JestDetector, MochaDetector, PlaywrightDetector, TestCafeDetector, VitestDetector } from './javascript';
import { GoTestDetector, JUnitDetector, KotestDetector, NUnitDetector, PHPUnitDetector, RSpecDetector, TestNGDetector, XCTestDetector, XUnitDetector } from './other-languages';
import { PytestDetector, RobotFrameworkDetector, UnittestDetector } from './python';

export class FrameworkDetectionOrchestrator {
  private detectors: Map<string, FrameworkDetector> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private config: FrameworkDetectionConfig;

  constructor(config?: Partial<FrameworkDetectionConfig>) {
    this.config = {
      autoDetect: config?.autoDetect ?? true,
      enabledLanguages: config?.enabledLanguages,
      disabledFrameworks: config?.disabledFrameworks ?? [],
      cacheTimeout: config?.cacheTimeout ?? 60 * 60 * 1000 // 1 hour
    };
    
    this.registerDefaultDetectors();
  }

  private registerDefaultDetectors(): void {
    // JavaScript/TypeScript frameworks
    this.registerDetector(new PlaywrightDetector());
    this.registerDetector(new JestDetector());
    this.registerDetector(new VitestDetector());
    this.registerDetector(new CypressDetector());
    this.registerDetector(new MochaDetector());
    this.registerDetector(new JasmineDetector());
    this.registerDetector(new TestCafeDetector());

    // Python frameworks
    this.registerDetector(new PytestDetector());
    this.registerDetector(new UnittestDetector());
    this.registerDetector(new RobotFrameworkDetector());

    // JVM frameworks
    this.registerDetector(new JUnitDetector());
    this.registerDetector(new TestNGDetector());
    this.registerDetector(new KotestDetector());

    // .NET frameworks
    this.registerDetector(new NUnitDetector());
    this.registerDetector(new XUnitDetector());

    // Other languages
    this.registerDetector(new RSpecDetector());
    this.registerDetector(new PHPUnitDetector());
    this.registerDetector(new GoTestDetector());
    this.registerDetector(new XCTestDetector());
  }

  private registerDetector(detector: FrameworkDetector): void {
    if (!this.config.disabledFrameworks?.includes(detector.name)) {
      this.detectors.set(detector.name, detector);
    }
  }

  /**
   * Detect all frameworks in the workspace
   */
  async detectAllFrameworks(): Promise<DiscoveredTestFrameworks> {
    if (!vscode.workspace.workspaceFolders) {
      return this.createEmptyResult();
    }

    const allFrameworks: TestFrameworkInfo[] = [];

    for (const folder of vscode.workspace.workspaceFolders) {
      const folderFrameworks = await this.detectFrameworksInFolder(folder);
      allFrameworks.push(...folderFrameworks.frameworks);
    }

    return this.categorizeFrameworks(allFrameworks);
  }

  /**
   * Detect frameworks in a specific workspace folder
   */
  async detectFrameworksInFolder(workspaceFolder: vscode.WorkspaceFolder): Promise<FolderFrameworkProfile> {
    // Check cache first
    const cached = this.cache.get(workspaceFolder.uri.fsPath);
    if (cached && !this.cacheExpired(cached)) {
      return cached.profile;
    }

    const detectedLanguages = await this.detectWorkspaceLanguages(workspaceFolder);
    const relevantDetectors = this.getRelevantDetectors(detectedLanguages);

    // Run detections in parallel
    const detectionPromises = Array.from(relevantDetectors.values()).map(async detector => {
      try {
        const result = await detector.detect(workspaceFolder);
        if (result.detected) {
          return {
            name: detector.name,
            detected: true,
            language: detector.language,
            icon: detector.icon,
            configFile: result.configFiles?.[0],
            workingDirectory: result.workingDirectory,
            command: result.command,
            confidence: result.confidence,
            evidence: result.evidence
          } as TestFrameworkInfo;
        }
        return null;
      } catch (error) {
        console.error(`Error detecting ${detector.name}:`, error);
        return null;
      }
    });

    const results = await Promise.all(detectionPromises);
    const frameworks = results.filter((r): r is TestFrameworkInfo => r !== null);

    const profile: FolderFrameworkProfile = {
      folderUri: workspaceFolder.uri.fsPath,
      detectedLanguages,
      frameworks
    };

    // Cache the result
    this.cache.set(workspaceFolder.uri.fsPath, {
      timestamp: Date.now(),
      profile
    });

    return profile;
  }

  /**
   * Detect languages present in the workspace
   */
  private async detectWorkspaceLanguages(workspaceFolder: vscode.WorkspaceFolder): Promise<string[]> {
    const languages = new Set<string>();

    // Check for language-specific files
    const languageMarkers = [
      { pattern: '**/*.{js,ts,jsx,tsx}', language: 'JavaScript/TypeScript' },
      { pattern: '**/*.py', language: 'Python' },
      { pattern: '**/*.java', language: 'Java' },
      { pattern: '**/*.cs', language: 'C#' },
      { pattern: '**/*.go', language: 'Go' },
      { pattern: '**/*.rb', language: 'Ruby' },
      { pattern: '**/*.php', language: 'PHP' },
      { pattern: '**/*.swift', language: 'Swift' },
      { pattern: '**/*.kt', language: 'Kotlin' }
    ];

    for (const marker of languageMarkers) {
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, marker.pattern),
        '**/node_modules/**',
        1
      );
      
      if (files.length > 0) {
        languages.add(marker.language);
      }
    }

    return Array.from(languages);
  }

  /**
   * Get detectors relevant for the detected languages
   */
  private getRelevantDetectors(detectedLanguages: string[]): Map<string, FrameworkDetector> {
    if (!this.config.autoDetect) {
      return this.detectors;
    }

    if (this.config.enabledLanguages && this.config.enabledLanguages.length > 0) {
      // Filter by explicitly enabled languages
      const relevant = new Map<string, FrameworkDetector>();
      for (const [name, detector] of this.detectors) {
        if (this.config.enabledLanguages.includes(detector.language)) {
          relevant.set(name, detector);
        }
      }
      return relevant;
    }

    if (detectedLanguages.length === 0) {
      // No languages detected, run all detectors
      return this.detectors;
    }

    // Filter detectors by detected languages
    const relevant = new Map<string, FrameworkDetector>();
    for (const [name, detector] of this.detectors) {
      if (detectedLanguages.includes(detector.language)) {
        relevant.set(name, detector);
      }
    }

    return relevant;
  }

  /**
   * Categorize frameworks by language
   */
  private categorizeFrameworks(frameworks: TestFrameworkInfo[]): DiscoveredTestFrameworks {
    const result: DiscoveredTestFrameworks = {
      javascript: [],
      python: [],
      java: [],
      csharp: [],
      ruby: [],
      php: [],
      go: [],
      swift: [],
      kotlin: [],
      all: frameworks
    };

    for (const framework of frameworks) {
      switch (framework.language) {
        case 'JavaScript/TypeScript':
          result.javascript.push(framework);
          break;
        case 'Python':
          result.python.push(framework);
          break;
        case 'Java':
          result.java.push(framework);
          break;
        case 'C#':
          result.csharp.push(framework);
          break;
        case 'Ruby':
          result.ruby.push(framework);
          break;
        case 'PHP':
          result.php.push(framework);
          break;
        case 'Go':
          result.go.push(framework);
          break;
        case 'Swift':
          result.swift.push(framework);
          break;
        case 'Kotlin':
          result.kotlin.push(framework);
          break;
      }
    }

    return result;
  }

  /**
   * Clear the detection cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if cache entry is expired
   */
  private cacheExpired(cached: CacheEntry): boolean {
    return Date.now() - cached.timestamp > this.config.cacheTimeout!;
  }

  /**
   * Create empty result when no workspace is open
   */
  private createEmptyResult(): DiscoveredTestFrameworks {
    return {
      javascript: [],
      python: [],
      java: [],
      csharp: [],
      ruby: [],
      php: [],
      go: [],
      swift: [],
      kotlin: [],
      all: []
    };
  }

  /**
   * Get a specific detector by name
   */
  getDetector(name: string): FrameworkDetector | undefined {
    return this.detectors.get(name);
  }

  /**
   * Get all registered detectors
   */
  getAllDetectors(): FrameworkDetector[] {
    return Array.from(this.detectors.values());
  }
}
