/**
 * Framework detection types and interfaces
 */

import * as vscode from 'vscode';

/**
 * Result of framework detection
 */
export interface DetectionResult {
  detected: boolean;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  configFiles?: string[];
  version?: string;
  workingDirectory?: string;
  command?: string;
}

/**
 * Test framework information for UI display
 */
export interface TestFrameworkInfo {
  name: string;
  detected: boolean;
  language: string;
  icon: string;
  configFile?: string;
  workingDirectory?: string;
  command?: string;
  confidence?: 'high' | 'medium' | 'low';
  evidence?: string[];
}

/**
 * Discovered frameworks by category
 */
export interface DiscoveredTestFrameworks {
  javascript: TestFrameworkInfo[];
  python: TestFrameworkInfo[];
  java: TestFrameworkInfo[];
  csharp: TestFrameworkInfo[];
  ruby: TestFrameworkInfo[];
  php: TestFrameworkInfo[];
  go: TestFrameworkInfo[];
  swift: TestFrameworkInfo[];
  kotlin: TestFrameworkInfo[];
  all: TestFrameworkInfo[];
}

/**
 * Workspace framework profile
 */
export interface WorkspaceFrameworkProfile {
  workspaceFolders: FolderFrameworkProfile[];
  detectedLanguages: string[];
  primaryLanguage?: string;
}

/**
 * Framework profile for a single workspace folder
 */
export interface FolderFrameworkProfile {
  folderUri: string;
  detectedLanguages: string[];
  frameworks: TestFrameworkInfo[];
}

/**
 * Abstract base class for framework detection
 */
export abstract class FrameworkDetector {
  abstract readonly name: string;
  abstract readonly language: string;
  abstract readonly icon: string;
  abstract readonly supportsProxy: boolean;
  
  /**
   * Detect if this framework is present in the workspace
   */
  abstract detect(workspaceFolder: vscode.WorkspaceFolder): Promise<DetectionResult>;
  
  /**
   * Get the default command to run tests
   */
  abstract getTestCommand(): string;
  
  /**
   * Check if framework supports HTTP proxy injection
   */
  canUseProxy(): boolean {
    return this.supportsProxy;
  }
}

/**
 * Cache entry for framework detection results
 */
export interface CacheEntry {
  timestamp: number;
  profile: FolderFrameworkProfile;
}

/**
 * Configuration for framework detection
 */
export interface FrameworkDetectionConfig {
  autoDetect: boolean;
  enabledLanguages?: string[];
  disabledFrameworks?: string[];
  cacheTimeout?: number; // milliseconds
}
