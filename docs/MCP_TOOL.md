# MCP Tool Implementation Plan for Traffic Cop

**Version:** 1.0  
**Date:** November 5, 2025  
**Author:** Max Golovanov  
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [MCP Server Design](#mcp-server-design)
5. [VS Code Extension Integration](#vs-code-extension-integration)
6. [HAR Analysis Tools](#har-analysis-tools)
7. [Implementation Phases](#implementation-phases)
8. [Testing Strategy](#testing-strategy)
9. [Future Enhancements](#future-enhancements)

---

## Executive Summary

This document outlines the implementation of a Model Context Protocol (MCP) server for the Traffic Cop VS Code extension. The MCP server will provide AI assistants with powerful HAR (HTTP Archive) analysis capabilities, enabling:

- **Real-time traffic inspection** during active captures
- **Post-capture analysis** of completed sessions
- **Statistical aggregation** (status codes, payload sizes, durations)
- **Advanced search** (URL patterns, regex, header matching)
- **Direct navigation** to specific requests in VS Code

### Key Design Principles

1. **Framework-agnostic core** - HAR analyzer has no VS Code dependencies
2. **Dual transport support** - STDIO for VS Code, HTTP for standalone servers
3. **Live + historical analysis** - Works with active captures and completed archives
4. **Test-first development** - Non-interactive tests before visual validation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Extension Host (extension.ts)                       │   │
│  │  - Registers MCP Server Definition Provider          │   │
│  │  - Spawns server.ts as child process (STDIO)         │   │
│  │  - Provides VS Code commands for navigation          │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▲ stdio                             │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│         MCP Server (server.ts) - Can run standalone          │
│  ┌──────────────────────┴──────────────────────────────┐   │
│  │  Transport Layer (STDIO or HTTP)                     │   │
│  │  - @modelcontextprotocol/sdk StdioServerTransport    │   │
│  │  - OR Streamable HTTP (for remote/standalone)        │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │  MCP Tools Registry                                  │   │
│  │  - investigate_failures                              │   │
│  │  - get_statistics_by_status                          │   │
│  │  - get_statistics_by_size                            │   │
│  │  │  - get_statistics_by_duration                     │   │
│  │  - find_authorization_failures                       │   │
│  │  - search_requests                                   │   │
│  │  - navigate_to_request                               │   │
│  │  - list_captures                                     │   │
│  │  - get_capture_summary                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │  HAR Analyzer (Framework-Agnostic)                   │   │
│  │  - HARParser: Parse HAR JSON                         │   │
│  │  - HARStatistics: Aggregate metrics                  │   │
│  │  - HARSearch: URL/regex/header search                │   │
│  │  - HARQuery: High-level query DSL                    │   │
│  │  - LiveHARTracker: In-memory active capture          │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │  Storage Layer                                       │   │
│  │  - Filesystem: .http-recorder/*.har                  │   │
│  │  - In-memory: Active capture buffer                  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Component Layering

| Layer | Purpose | Dependencies |
|-------|---------|--------------|
| **VS Code Extension** | MCP server registration, UI commands | `vscode` API |
| **MCP Server** | Tool definitions, transport handling | `@modelcontextprotocol/sdk` |
| **HAR Analyzer** | Business logic, search, statistics | **None** (pure TypeScript) |
| **Storage** | File I/O, in-memory cache | `fs/promises` |

---

## Core Components

### 1. HAR Analyzer Core (`src/mcp/analyzer/`)

Framework-agnostic classes for HAR manipulation. **NO** VS Code imports allowed.

#### `HARParser.ts`

```typescript
export interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    cookies: Array<{ name: string; value: string }>;
    headersSize: number;
    bodySize: number;
    postData?: {
      mimeType: string;
      text: string;
      params?: Array<{ name: string; value: string }>;
    };
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: Array<{ name: string; value: string }>;
    cookies: Array<{ name: string; value: string }>;
    content: {
      size: number;
      compression?: number;
      mimeType: string;
      text?: string;
      encoding?: string;
    };
    redirectURL: string;
    headersSize: number;
    bodySize: number;
  };
  cache: object;
  timings: {
    blocked?: number;
    dns?: number;
    connect?: number;
    send: number;
    wait: number;
    receive: number;
    ssl?: number;
  };
  serverIPAddress?: string;
  connection?: string;
  comment?: string;
}

export interface HAR {
  log: {
    version: string;
    creator: { name: string; version: string };
    browser?: { name: string; version: string };
    pages?: Array<{
      startedDateTime: string;
      id: string;
      title: string;
      pageTimings: { onContentLoad?: number; onLoad?: number };
    }>;
    entries: HAREntry[];
    comment?: string;
  };
}

export class HARParser {
  /**
   * Parse HAR file from JSON string
   */
  static parse(json: string): HAR {
    const data = JSON.parse(json);
    
    // Validate basic structure
    if (!data.log || !data.log.entries || !Array.isArray(data.log.entries)) {
      throw new Error('Invalid HAR format: missing log.entries');
    }
    
    return data as HAR;
  }

  /**
   * Validate HAR structure (throws if invalid)
   */
  static validate(har: HAR): void {
    if (!har.log.version) {
      throw new Error('Invalid HAR: missing version');
    }
    
    for (const [index, entry] of har.log.entries.entries()) {
      if (!entry.request || !entry.response) {
        throw new Error(`Invalid HAR entry at index ${index}: missing request/response`);
      }
    }
  }

  /**
   * Extract URL from entry
   */
  static getURL(entry: HAREntry): URL {
    return new URL(entry.request.url);
  }

  /**
   * Get header value (case-insensitive)
   */
  static getHeader(
    headers: Array<{ name: string; value: string }>,
    name: string
  ): string | undefined {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value;
  }
}
```

#### `HARStatistics.ts`

```typescript
export interface StatusCodeStats {
  code: number;
  count: number;
  totalDuration: number;
  avgDuration: number;
  urls: string[];
}

export interface PayloadSizeStats {
  sizeRange: string; // e.g., "0-1KB", "1KB-10KB"
  count: number;
  totalSize: number;
  avgSize: number;
  urls: string[];
}

export interface DurationStats {
  durationRange: string; // e.g., "0-100ms", "100ms-1s"
  count: number;
  totalDuration: number;
  avgDuration: number;
  urls: string[];
}

export class HARStatistics {
  /**
   * Group entries by HTTP status code
   */
  static groupByStatus(entries: HAREntry[]): StatusCodeStats[] {
    const groups = new Map<number, HAREntry[]>();
    
    for (const entry of entries) {
      const code = entry.response.status;
      if (!groups.has(code)) {
        groups.set(code, []);
      }
      groups.get(code)!.push(entry);
    }

    return Array.from(groups.entries())
      .map(([code, entries]) => ({
        code,
        count: entries.length,
        totalDuration: entries.reduce((sum, e) => sum + e.time, 0),
        avgDuration: entries.reduce((sum, e) => sum + e.time, 0) / entries.length,
        urls: entries.map(e => e.request.url)
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Group entries by payload size ranges
   */
  static groupBySize(entries: HAREntry[]): PayloadSizeStats[] {
    const ranges = [
      { min: 0, max: 1024, label: '0-1KB' },
      { min: 1024, max: 10240, label: '1KB-10KB' },
      { min: 10240, max: 102400, label: '10KB-100KB' },
      { min: 102400, max: 1048576, label: '100KB-1MB' },
      { min: 1048576, max: Infinity, label: '1MB+' }
    ];

    const groups = new Map<string, HAREntry[]>();
    
    for (const range of ranges) {
      groups.set(range.label, []);
    }

    for (const entry of entries) {
      const size = entry.response.content.size;
      const range = ranges.find(r => size >= r.min && size < r.max);
      
      if (range) {
        groups.get(range.label)!.push(entry);
      }
    }

    return Array.from(groups.entries())
      .map(([sizeRange, entries]) => ({
        sizeRange,
        count: entries.length,
        totalSize: entries.reduce((sum, e) => sum + e.response.content.size, 0),
        avgSize: entries.length > 0 
          ? entries.reduce((sum, e) => sum + e.response.content.size, 0) / entries.length 
          : 0,
        urls: entries.map(e => e.request.url)
      }))
      .filter(stat => stat.count > 0);
  }

  /**
   * Group entries by duration ranges
   */
  static groupByDuration(entries: HAREntry[]): DurationStats[] {
    const ranges = [
      { min: 0, max: 100, label: '0-100ms' },
      { min: 100, max: 1000, label: '100ms-1s' },
      { min: 1000, max: 5000, label: '1s-5s' },
      { min: 5000, max: Infinity, label: '5s+' }
    ];

    const groups = new Map<string, HAREntry[]>();
    
    for (const range of ranges) {
      groups.set(range.label, []);
    }

    for (const entry of entries) {
      const duration = entry.time;
      const range = ranges.find(r => duration >= r.min && duration < r.max);
      
      if (range) {
        groups.get(range.label)!.push(entry);
      }
    }

    return Array.from(groups.entries())
      .map(([durationRange, entries]) => ({
        durationRange,
        count: entries.length,
        totalDuration: entries.reduce((sum, e) => sum + e.time, 0),
        avgDuration: entries.length > 0 
          ? entries.reduce((sum, e) => sum + e.time, 0) / entries.length 
          : 0,
        urls: entries.map(e => e.request.url)
      }))
      .filter(stat => stat.count > 0);
  }

  /**
   * Find authorization/authentication failures (401, 403)
   */
  static findAuthFailures(entries: HAREntry[]): Array<{
    url: string;
    method: string;
    status: number;
    statusText: string;
    timestamp: string;
  }> {
    return entries
      .filter(e => e.response.status === 401 || e.response.status === 403)
      .map(e => ({
        url: e.request.url,
        method: e.request.method,
        status: e.response.status,
        statusText: e.response.statusText,
        timestamp: e.startedDateTime
      }));
  }
}
```

#### `HARSearch.ts`

```typescript
export interface SearchCriteria {
  url?: string;              // Substring match
  urlRegex?: string;         // Regex pattern
  method?: string;           // HTTP method (GET, POST, etc.)
  statusCode?: number;       // Exact status
  statusRange?: [number, number]; // e.g., [400, 499] for 4xx errors
  minDuration?: number;      // Minimum request duration (ms)
  maxDuration?: number;      // Maximum request duration (ms)
  minSize?: number;          // Minimum payload size (bytes)
  maxSize?: number;          // Maximum payload size (bytes)
  headers?: Record<string, string>; // Header name-value pairs
  hasRequestBody?: boolean;  // Has POST data
  hasResponseBody?: boolean; // Has response content
}

export interface SearchResult {
  entry: HAREntry;
  index: number;             // Original index in HAR entries array
  matchReason: string[];     // Why this entry matched
}

export class HARSearch {
  /**
   * Search HAR entries with flexible criteria
   */
  static search(entries: HAREntry[], criteria: SearchCriteria): SearchResult[] {
    const results: SearchResult[] = [];

    for (const [index, entry] of entries.entries()) {
      const matchReasons: string[] = [];

      // URL substring match
      if (criteria.url && entry.request.url.includes(criteria.url)) {
        matchReasons.push(`URL contains "${criteria.url}"`);
      }

      // URL regex match
      if (criteria.urlRegex) {
        const regex = new RegExp(criteria.urlRegex, 'i');
        if (regex.test(entry.request.url)) {
          matchReasons.push(`URL matches regex /${criteria.urlRegex}/`);
        }
      }

      // HTTP method match
      if (criteria.method && entry.request.method.toUpperCase() === criteria.method.toUpperCase()) {
        matchReasons.push(`Method is ${criteria.method}`);
      }

      // Status code match
      if (criteria.statusCode && entry.response.status === criteria.statusCode) {
        matchReasons.push(`Status code is ${criteria.statusCode}`);
      }

      // Status range match
      if (criteria.statusRange) {
        const [min, max] = criteria.statusRange;
        if (entry.response.status >= min && entry.response.status <= max) {
          matchReasons.push(`Status in range ${min}-${max}`);
        }
      }

      // Duration match
      if (criteria.minDuration !== undefined && entry.time >= criteria.minDuration) {
        matchReasons.push(`Duration >= ${criteria.minDuration}ms`);
      }
      if (criteria.maxDuration !== undefined && entry.time <= criteria.maxDuration) {
        matchReasons.push(`Duration <= ${criteria.maxDuration}ms`);
      }

      // Size match
      const size = entry.response.content.size;
      if (criteria.minSize !== undefined && size >= criteria.minSize) {
        matchReasons.push(`Size >= ${criteria.minSize} bytes`);
      }
      if (criteria.maxSize !== undefined && size <= criteria.maxSize) {
        matchReasons.push(`Size <= ${criteria.maxSize} bytes`);
      }

      // Header match
      if (criteria.headers) {
        for (const [headerName, headerValue] of Object.entries(criteria.headers)) {
          const actualValue = HARParser.getHeader(entry.request.headers, headerName);
          if (actualValue && actualValue.includes(headerValue)) {
            matchReasons.push(`Header ${headerName} contains "${headerValue}"`);
          }
        }
      }

      // Request body match
      if (criteria.hasRequestBody !== undefined) {
        const hasBody = !!entry.request.postData;
        if (criteria.hasRequestBody === hasBody) {
          matchReasons.push(hasBody ? 'Has request body' : 'No request body');
        }
      }

      // Response body match
      if (criteria.hasResponseBody !== undefined) {
        const hasBody = !!entry.response.content.text;
        if (criteria.hasResponseBody === hasBody) {
          matchReasons.push(hasBody ? 'Has response body' : 'No response body');
        }
      }

      // Add to results if at least one criterion matched
      if (matchReasons.length > 0) {
        results.push({ entry, index, matchReason: matchReasons });
      }
    }

    return results;
  }

  /**
   * Quick search by URL pattern (most common use case)
   */
  static byURL(entries: HAREntry[], pattern: string, regex = false): SearchResult[] {
    return this.search(entries, regex ? { urlRegex: pattern } : { url: pattern });
  }

  /**
   * Find failed requests (4xx, 5xx)
   */
  static findFailures(entries: HAREntry[]): SearchResult[] {
    return this.search(entries, { statusRange: [400, 599] });
  }

  /**
   * Find slow requests
   */
  static findSlow(entries: HAREntry[], thresholdMs = 1000): SearchResult[] {
    return this.search(entries, { minDuration: thresholdMs });
  }
}
```

#### `LiveHARTracker.ts`

```typescript
/**
 * Tracks in-memory HAR entries for active captures
 */
export class LiveHARTracker {
  private entries: HAREntry[] = [];
  private readonly maxEntries = 10000; // Prevent memory overflow

  /**
   * Add entry to live buffer
   */
  add(entry: HAREntry): void {
    this.entries.push(entry);
    
    // Trim if exceeding max
    if (this.entries.length > this.maxEntries) {
      this.entries.shift(); // Remove oldest
    }
  }

  /**
   * Get all current entries
   */
  getAll(): HAREntry[] {
    return [...this.entries];
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Export as HAR
   */
  toHAR(): HAR {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'Traffic Cop',
          version: '0.7.0'
        },
        entries: this.entries
      }
    };
  }

  /**
   * Get entry count
   */
  get count(): number {
    return this.entries.length;
  }
}
```

---

### 2. MCP Server (`src/mcp/server.ts`)

Implements MCP protocol with tool definitions. Supports both STDIO and HTTP transports.

```typescript
#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { HARParser, HARStatistics, HARSearch, LiveHARTracker } from './analyzer';

/**
 * Configuration for MCP server
 */
interface ServerConfig {
  recordingsDir: string;      // Path to .http-recorder directory
  transport: 'stdio' | 'http'; // Transport type
  httpPort?: number;           // For HTTP transport
}

/**
 * Main MCP server class
 */
class TrafficCopMCPServer {
  private server: McpServer;
  private config: ServerConfig;
  private liveTracker = new LiveHARTracker();

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new McpServer({
      name: 'Traffic Cop HAR Analyzer',
      version: '0.7.0'
    });

    this.registerTools();
  }

  /**
   * Register all MCP tools
   */
  private registerTools() {
    // Tool 1: List all captures
    this.server.tool(
      'list_captures',
      'Lists all HAR capture files in the recordings directory',
      {
        pattern: z.string().optional().describe('Optional glob pattern to filter files')
      },
      async ({ pattern }) => {
        const files = await this.listCaptureFiles(pattern);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(files, null, 2)
          }]
        };
      }
    );

    // Tool 2: Get capture summary
    this.server.tool(
      'get_capture_summary',
      'Gets summary statistics for a specific HAR file',
      {
        filename: z.string().describe('HAR filename (or "latest" for most recent)')
      },
      async ({ filename }) => {
        const har = await this.loadHAR(filename);
        const summary = this.getSummary(har);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(summary, null, 2)
          }]
        };
      }
    );

    // Tool 3: Get statistics by status code
    this.server.tool(
      'get_statistics_by_status',
      'Groups requests by HTTP status code with counts and durations',
      {
        filename: z.string().describe('HAR filename or "latest" or "live"')
      },
      async ({ filename }) => {
        const entries = await this.getEntries(filename);
        const stats = HARStatistics.groupByStatus(entries);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(stats, null, 2)
          }]
        };
      }
    );

    // Tool 4: Get statistics by payload size
    this.server.tool(
      'get_statistics_by_size',
      'Groups requests by payload size ranges',
      {
        filename: z.string().describe('HAR filename or "latest" or "live"')
      },
      async ({ filename }) => {
        const entries = await this.getEntries(filename);
        const stats = HARStatistics.groupBySize(entries);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(stats, null, 2)
          }]
        };
      }
    );

    // Tool 5: Get statistics by duration
    this.server.tool(
      'get_statistics_by_duration',
      'Groups requests by response time ranges',
      {
        filename: z.string().describe('HAR filename or "latest" or "live"')
      },
      async ({ filename }) => {
        const entries = await this.getEntries(filename);
        const stats = HARStatistics.groupByDuration(entries);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(stats, null, 2)
          }]
        };
      }
    );

    // Tool 6: Find authorization failures
    this.server.tool(
      'find_authorization_failures',
      'Finds all 401/403 authentication/authorization failures',
      {
        filename: z.string().describe('HAR filename or "latest" or "live"')
      },
      async ({ filename }) => {
        const entries = await this.getEntries(filename);
        const failures = HARStatistics.findAuthFailures(entries);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(failures, null, 2)
          }]
        };
      }
    );

    // Tool 7: Investigate failures
    this.server.tool(
      'investigate_failures',
      'Finds all failed requests (4xx, 5xx status codes) with details',
      {
        filename: z.string().describe('HAR filename or "latest" or "live"')
      },
      async ({ filename }) => {
        const entries = await this.getEntries(filename);
        const results = HARSearch.findFailures(entries);
        
        const formatted = results.map(r => ({
          url: r.entry.request.url,
          method: r.entry.request.method,
          status: r.entry.response.status,
          statusText: r.entry.response.statusText,
          duration: r.entry.time,
          timestamp: r.entry.startedDateTime,
          index: r.index
        }));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formatted, null, 2)
          }]
        };
      }
    );

    // Tool 8: Search requests
    this.server.tool(
      'search_requests',
      'Advanced search across HAR entries with multiple criteria',
      {
        filename: z.string().describe('HAR filename or "latest" or "live"'),
        url: z.string().optional().describe('URL substring to match'),
        urlRegex: z.string().optional().describe('URL regex pattern'),
        method: z.string().optional().describe('HTTP method (GET, POST, etc.)'),
        statusCode: z.number().optional().describe('Exact status code'),
        minStatusCode: z.number().optional().describe('Minimum status code'),
        maxStatusCode: z.number().optional().describe('Maximum status code'),
        minDuration: z.number().optional().describe('Minimum duration in ms'),
        maxDuration: z.number().optional().describe('Maximum duration in ms'),
        minSize: z.number().optional().describe('Minimum payload size in bytes'),
        maxSize: z.number().optional().describe('Maximum payload size in bytes')
      },
      async (args) => {
        const { filename, minStatusCode, maxStatusCode, ...criteria } = args;
        const entries = await this.getEntries(filename);
        
        // Build search criteria
        const searchCriteria: any = { ...criteria };
        if (minStatusCode !== undefined && maxStatusCode !== undefined) {
          searchCriteria.statusRange = [minStatusCode, maxStatusCode];
        }
        
        const results = HARSearch.search(entries, searchCriteria);
        
        const formatted = results.map(r => ({
          url: r.entry.request.url,
          method: r.entry.request.method,
          status: r.entry.response.status,
          duration: r.entry.time,
          size: r.entry.response.content.size,
          timestamp: r.entry.startedDateTime,
          matchReason: r.matchReason,
          index: r.index
        }));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formatted, null, 2)
          }]
        };
      }
    );

    // Tool 9: Navigate to request (VS Code only)
    this.server.tool(
      'navigate_to_request',
      'Opens the HAR file in VS Code and navigates to a specific request entry. Only works when running in VS Code.',
      {
        filename: z.string().describe('HAR filename'),
        index: z.number().describe('Entry index from search results')
      },
      async ({ filename, index }) => {
        // This tool will send a message back to VS Code extension
        // The extension will handle the actual navigation
        
        // Check if running in VS Code context
        if (process.env.VSCODE_TRAFFIC_COP !== 'true') {
          return {
            content: [{
              type: 'text',
              text: 'Error: navigate_to_request only works in VS Code context'
            }]
          };
        }
        
        // Send navigation request to extension via process messaging
        if (process.send) {
          process.send({
            type: 'navigate',
            filename,
            index
          });
        }
        
        return {
          content: [{
            type: 'text',
            text: `Navigation request sent for ${filename}:${index}`
          }]
        };
      }
    );
  }

  /**
   * List all HAR files in recordings directory
   */
  private async listCaptureFiles(pattern?: string): Promise<Array<{
    filename: string;
    path: string;
    size: number;
    modified: string;
  }>> {
    const files = await readdir(this.config.recordingsDir);
    const harFiles = files.filter(f => f.endsWith('.har'));
    
    const details = await Promise.all(
      harFiles.map(async filename => {
        const fullPath = join(this.config.recordingsDir, filename);
        const stat = await readFile(fullPath).then(buf => ({
          size: buf.length,
          modified: new Date().toISOString() // Would use fs.stat in real implementation
        }));
        
        return {
          filename,
          path: fullPath,
          size: stat.size,
          modified: stat.modified
        };
      })
    );
    
    return details.sort((a, b) => b.modified.localeCompare(a.modified));
  }

  /**
   * Load HAR file (supports "latest", "live", or specific filename)
   */
  private async loadHAR(filename: string): Promise<HAR> {
    if (filename === 'live') {
      return this.liveTracker.toHAR();
    }
    
    if (filename === 'latest') {
      const files = await this.listCaptureFiles();
      if (files.length === 0) {
        throw new Error('No HAR files found');
      }
      filename = files[0].filename;
    }
    
    const fullPath = join(this.config.recordingsDir, filename);
    const content = await readFile(fullPath, 'utf-8');
    return HARParser.parse(content);
  }

  /**
   * Get entries from HAR file or live tracker
   */
  private async getEntries(filename: string): Promise<HAREntry[]> {
    const har = await this.loadHAR(filename);
    return har.log.entries;
  }

  /**
   * Generate summary statistics for a HAR
   */
  private getSummary(har: HAR) {
    const entries = har.log.entries;
    
    return {
      totalRequests: entries.length,
      totalDuration: entries.reduce((sum, e) => sum + e.time, 0),
      avgDuration: entries.reduce((sum, e) => sum + e.time, 0) / entries.length,
      totalBytes: entries.reduce((sum, e) => sum + e.response.content.size, 0),
      statusCodes: HARStatistics.groupByStatus(entries),
      timeRange: {
        start: entries[0]?.startedDateTime,
        end: entries[entries.length - 1]?.startedDateTime
      }
    };
  }

  /**
   * Update live tracker (called by extension during active capture)
   */
  public addLiveEntry(entry: HAREntry): void {
    this.liveTracker.add(entry);
  }

  /**
   * Start the MCP server
   */
  async start() {
    if (this.config.transport === 'stdio') {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Traffic Cop MCP Server started (STDIO)');
    } else {
      // HTTP transport implementation would go here
      throw new Error('HTTP transport not yet implemented');
    }
  }
}

// CLI entry point
if (require.main === module) {
  const config: ServerConfig = {
    recordingsDir: process.env.RECORDINGS_DIR || '.http-recorder',
    transport: (process.env.TRANSPORT as 'stdio' | 'http') || 'stdio',
    httpPort: process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : undefined
  };
  
  const server = new TrafficCopMCPServer(config);
  server.start().catch(console.error);
}

export { TrafficCopMCPServer, ServerConfig };
```

---

### 3. VS Code Extension Integration

Modify `src/extension.ts` to register MCP server provider:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  // ... existing code ...

  // Register MCP Server Definition Provider
  const didChangeEmitter = new vscode.EventEmitter<void>();
  
  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider('trafficCopMcp', {
      onDidChangeMcpServerDefinitions: didChangeEmitter.event,

      provideMcpServerDefinitions: async () => {
        const serverPath = vscode.Uri.joinPath(
          context.extensionUri,
          'dist',
          'mcp',
          'server.js'
        );

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          return [];
        }

        const recordingsDir = path.join(
          workspaceFolders[0].uri.fsPath,
          '.http-recorder'
        );

        return [
          new vscode.McpStdioServerDefinition(
            'Traffic Cop HAR Analyzer',
            'node',
            [serverPath.fsPath],
            {
              RECORDINGS_DIR: recordingsDir,
              TRANSPORT: 'stdio',
              VSCODE_TRAFFIC_COP: 'true'
            },
            '0.7.0'
          )
        ];
      },

      resolveMcpServerDefinition: async (server) => {
        // Validate server exists
        return server;
      }
    })
  );

  // Handle navigation requests from MCP server
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'traffic-cop.navigateToEntry',
      async (filename: string, index: number) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const harPath = path.join(
          workspaceFolders[0].uri.fsPath,
          '.http-recorder',
          filename
        );

        // Open HAR file
        const doc = await vscode.workspace.openTextDocument(harPath);
        const editor = await vscode.window.showTextDocument(doc);

        // Find entry at index (simple line-based search)
        const text = doc.getText();
        const entriesMatch = text.match(/"entries"\s*:\s*\[/);
        
        if (entriesMatch) {
          const entriesStart = entriesMatch.index! + entriesMatch[0].length;
          // Navigate to approximate position (would need smarter JSON parsing)
          const position = doc.positionAt(entriesStart);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position));
        }
      }
    )
  );
}
```

Update `package.json` to declare MCP server provider:

```json
{
  "contributes": {
    "mcpServerDefinitionProviders": [
      {
        "id": "trafficCopMcp",
        "label": "Traffic Cop HAR Analyzer"
      }
    ]
  }
}
```

---

## HAR Analysis Tools

### Tool Catalog

| Tool Name | Purpose | Parameters | Returns |
|-----------|---------|------------|---------|
| `list_captures` | Lists all HAR files | `pattern` (optional) | Array of file metadata |
| `get_capture_summary` | Summary stats for HAR | `filename` | Total requests, duration, bytes, status codes |
| `get_statistics_by_status` | Group by HTTP status | `filename` | Status code breakdown with counts |
| `get_statistics_by_size` | Group by payload size | `filename` | Size range breakdown |
| `get_statistics_by_duration` | Group by request time | `filename` | Duration range breakdown |
| `find_authorization_failures` | Find 401/403 errors | `filename` | Auth failure details |
| `investigate_failures` | Find all 4xx/5xx errors | `filename` | Failure details with URLs |
| `search_requests` | Advanced multi-criteria search | `filename`, criteria | Matching requests |
| `navigate_to_request` | Open in VS Code (VS Code only) | `filename`, `index` | Navigation confirmation |

### Special Filename Values

- `"latest"` - Most recently modified HAR file
- `"live"` - In-memory buffer of active capture (if recording is active)
- `"session_2025-11-05_14-30-00.har"` - Specific filename

---

## Implementation Phases

### Phase 1: Core HAR Analyzer (Week 1)

**Goal:** Framework-agnostic HAR manipulation classes

- [ ] Implement `HARParser.ts` with validation
- [ ] Implement `HARStatistics.ts` with grouping functions
- [ ] Implement `HARSearch.ts` with flexible criteria
- [ ] Implement `LiveHARTracker.ts` for in-memory buffering
- [ ] Write unit tests for all classes (Vitest)
- [ ] Ensure zero VS Code dependencies

**Acceptance Criteria:**
- All unit tests pass
- Can parse real HAR files from Playwright
- Statistics match manual calculations
- Search finds correct entries

---

### Phase 2: MCP Server (Week 2)

**Goal:** Standalone MCP server with tool definitions

- [ ] Implement `server.ts` with McpServer initialization
- [ ] Register all 9 tools with proper schemas
- [ ] Implement STDIO transport
- [ ] Add error handling and logging
- [ ] Test with MCP Inspector (`npx @modelcontextprotocol/inspector`)
- [ ] Document tool schemas and examples

**Acceptance Criteria:**
- MCP Inspector can connect and list tools
- All tools respond with valid JSON
- Can analyze HAR files via CLI
- Error messages are clear

---

### Phase 3: VS Code Integration (Week 2)

**Goal:** Register MCP server in Traffic Cop extension

- [ ] Add MCP provider to `extension.ts`
- [ ] Update `package.json` with `mcpServerDefinitionProviders`
- [ ] Implement `navigate_to_request` command
- [ ] Handle process messaging for navigation
- [ ] Add `.vscode/mcp.json` for local testing
- [ ] Bundle MCP server in extension VSIX

**Acceptance Criteria:**
- Extension registers MCP server on activation
- GitHub Copilot can discover Traffic Cop tools
- Navigation command opens HAR file at correct position
- Works in both local and remote workspaces

---

### Phase 4: Live Capture Integration (Week 3)

**Goal:** Real-time HAR entry streaming during active captures

- [ ] Hook into Dev Proxy capture events
- [ ] Stream entries to `LiveHARTracker`
- [ ] Implement `addLiveEntry` API
- [ ] Add status bar indicator for live buffer size
- [ ] Clear buffer on capture stop
- [ ] Test with concurrent captures

**Acceptance Criteria:**
- `"live"` filename returns current capture buffer
- Statistics update in real-time
- No memory leaks during long captures
- Buffer auto-trims at 10,000 entries

---

### Phase 5: Advanced Features (Week 4)

**Goal:** Enhanced analysis and visualization

- [ ] Add MCP sampling for recursive analysis
- [ ] Implement HAR diff tool (compare two captures)
- [ ] Add cost estimation for API calls (OpenAI, Azure)
- [ ] Create markdown reports via MCP resources
- [ ] Add HAR file compression/archiving
- [ ] Implement HTTP transport for remote MCP server

**Acceptance Criteria:**
- Can compare before/after captures
- Cost estimates match actual billing
- Markdown reports render in VS Code
- Remote MCP server works over HTTPS

---

## Testing Strategy

### Unit Tests (Vitest)

**Location:** `tests/mcp/analyzer/`

```typescript
// tests/mcp/analyzer/HARParser.test.ts
import { describe, it, expect } from 'vitest';
import { HARParser } from '../../../src/mcp/analyzer/HARParser';

describe('HARParser', () => {
  it('should parse valid HAR JSON', () => {
    const json = JSON.stringify({
      log: {
        version: '1.2',
        creator: { name: 'Test', version: '1.0' },
        entries: []
      }
    });
    
    const har = HARParser.parse(json);
    expect(har.log.version).toBe('1.2');
  });

  it('should throw on invalid HAR', () => {
    expect(() => HARParser.parse('{}')).toThrow('Invalid HAR format');
  });

  it('should extract URL from entry', () => {
    const entry = {
      request: { url: 'https://api.example.com/users' },
      response: {},
      startedDateTime: '',
      time: 0
    } as any;
    
    const url = HARParser.getURL(entry);
    expect(url.hostname).toBe('api.example.com');
  });
});
```

**Test Coverage Goals:**
- `HARParser`: 100% (critical path)
- `HARStatistics`: 95% (edge cases optional)
- `HARSearch`: 90% (complex criteria combinations)
- `LiveHARTracker`: 100% (memory safety critical)

---

### Integration Tests (Vitest + MCP Inspector)

**Location:** `tests/mcp/`

```typescript
// tests/mcp/server.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TrafficCopMCPServer } from '../../src/mcp/server';
import { spawn } from 'child_process';

describe('MCP Server Integration', () => {
  let serverProcess: any;

  beforeAll(async () => {
    // Spawn server process
    serverProcess = spawn('node', ['dist/mcp/server.js'], {
      env: {
        RECORDINGS_DIR: './tests/fixtures/har',
        TRANSPORT: 'stdio'
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for startup
  });

  afterAll(() => {
    serverProcess.kill();
  });

  it('should list tools via MCP protocol', async () => {
    // Send JSON-RPC request
    const request = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1
    };
    
    serverProcess.stdin.write(JSON.stringify(request) + '\n');
    
    // Read response
    const response = await new Promise(resolve => {
      serverProcess.stdout.once('data', data => {
        resolve(JSON.parse(data.toString()));
      });
    });
    
    expect(response).toHaveProperty('result.tools');
    expect(response.result.tools.length).toBeGreaterThan(0);
  });
});
```

---

### E2E Tests (Playwright)

**Location:** `tests/playwright/mcp.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Traffic Cop MCP Extension', () => {
  test('should register MCP server on activation', async ({ page }) => {
    // Open VS Code
    await page.goto('vscode://...');
    
    // Activate extension
    await page.click('[data-command="traffic-cop.startRecording"]');
    
    // Check MCP server is registered
    const mcpSettings = await page.evaluate(() => {
      return vscode.workspace.getConfiguration('mcp.servers');
    });
    
    expect(mcpSettings).toHaveProperty('trafficCopMcp');
  });

  test('should navigate to HAR entry from MCP tool', async ({ page }) => {
    // Simulate MCP tool call
    await page.evaluate(() => {
      vscode.commands.executeCommand(
        'traffic-cop.navigateToEntry',
        'session_test.har',
        0
      );
    });
    
    // Verify HAR file is opened
    const activeEditor = await page.evaluate(() => {
      return vscode.window.activeTextEditor?.document.fileName;
    });
    
    expect(activeEditor).toContain('session_test.har');
  });
});
```

---

## Future Enhancements

### 1. MCP Sampling for Recursive Analysis

**Concept:** Allow MCP server to make its own LLM requests for deep analysis

```typescript
// Example: Analyze error patterns using sampling
this.server.tool(
  'analyze_error_patterns',
  'Uses AI to identify common error patterns in failed requests',
  { filename: z.string() },
  async ({ filename }, { sampling }) => {
    const failures = await this.investigateFailures(filename);
    
    // Make recursive LLM call
    const analysis = await sampling.createMessage({
      messages: [{
        role: 'user',
        content: `Analyze these HTTP errors and identify patterns:\n${JSON.stringify(failures, null, 2)}`
      }],
      maxTokens: 1000
    });
    
    return {
      content: [{
        type: 'text',
        text: analysis.content[0].text
      }]
    };
  }
);
```

**Use Cases:**
- Root cause analysis of cascading failures
- API cost optimization recommendations
- Security vulnerability detection (auth bypass patterns)

---

### 2. HAR Diff Tool

**Concept:** Compare two HAR captures to identify changes

```typescript
interface DiffResult {
  added: string[];      // New requests in second capture
  removed: string[];    // Requests missing in second capture
  modified: Array<{     // Requests with different responses
    url: string;
    statusChanged: boolean;
    sizeChanged: boolean;
    durationChanged: boolean;
  }>;
}
```

**Use Cases:**
- Regression testing (compare before/after code changes)
- Performance tracking (identify slow-downs)
- API contract monitoring (detect breaking changes)

---

### 3. Cost Estimation

**Concept:** Calculate API costs from captured traffic

```typescript
const costEstimator = {
  'api.openai.com': (entry: HAREntry) => {
    const tokens = estimateTokens(entry.response.content.text);
    return tokens * 0.002 / 1000; // GPT-4 pricing
  },
  'api.anthropic.com': (entry: HAREntry) => {
    const tokens = estimateTokens(entry.response.content.text);
    return tokens * 0.015 / 1000; // Claude pricing
  }
};
```

**Use Cases:**
- Budget tracking for AI API usage
- Cost-per-test calculation
- Identifying expensive endpoints

---

### 4. Markdown Report Generation

**Concept:** Export HAR analysis as markdown via MCP resources

```typescript
this.server.resource(
  'report://summary',
  'Markdown summary report of latest capture',
  async () => {
    const har = await this.loadHAR('latest');
    const summary = this.getSummary(har);
    
    const markdown = `
# HAR Analysis Report

**Total Requests:** ${summary.totalRequests}
**Total Duration:** ${summary.totalDuration}ms
**Total Bytes:** ${summary.totalBytes}

## Status Code Breakdown

${summary.statusCodes.map(s => `- ${s.code}: ${s.count} requests (${s.avgDuration}ms avg)`).join('\n')}
    `;
    
    return {
      content: [{
        type: 'text',
        text: markdown,
        mimeType: 'text/markdown'
      }]
    };
  }
);
```

---

### 5. HTTP Transport for Remote MCP Server

**Concept:** Run MCP server as standalone service accessible over HTTPS

```typescript
// Streamable HTTP transport
import { StreamableHttpServerTransport } from '@modelcontextprotocol/sdk/server/http.js';

if (config.transport === 'http') {
  const transport = new StreamableHttpServerTransport({
    port: config.httpPort,
    path: '/mcp'
  });
  
  await this.server.connect(transport);
  console.log(`MCP Server running on http://localhost:${config.httpPort}/mcp`);
}
```

**Use Cases:**
- Team-wide HAR analysis service
- CI/CD pipeline integration
- Cloud-hosted analysis (Azure, AWS)

---

## Security Considerations

### 1. Credential Anonymization

HAR files may contain sensitive headers (Authorization, cookies). Implement automatic redaction:

```typescript
export class HARAnonymizer {
  private static readonly SENSITIVE_HEADERS = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'api-key'
  ];

  static anonymize(har: HAR): HAR {
    for (const entry of har.log.entries) {
      // Redact request headers
      entry.request.headers = entry.request.headers.map(h =>
        this.SENSITIVE_HEADERS.includes(h.name.toLowerCase())
          ? { name: h.name, value: '[REDACTED]' }
          : h
      );
      
      // Redact response headers
      entry.response.headers = entry.response.headers.map(h =>
        this.SENSITIVE_HEADERS.includes(h.name.toLowerCase())
          ? { name: h.name, value: '[REDACTED]' }
          : h
      );
    }
    
    return har;
  }
}
```

### 2. Access Control

MCP server should validate workspace access:

```typescript
private async validateAccess(filename: string): Promise<void> {
  const fullPath = resolve(this.config.recordingsDir, filename);
  
  // Prevent directory traversal
  if (!fullPath.startsWith(this.config.recordingsDir)) {
    throw new Error('Access denied: path outside recordings directory');
  }
}
```

---

## Deployment Checklist

- [ ] Core analyzer classes have 100% test coverage
- [ ] MCP server passes MCP Inspector validation
- [ ] VS Code extension registers provider correctly
- [ ] All tools return valid JSON schemas
- [ ] Navigation command works in local and remote workspaces
- [ ] Live tracking handles high-volume captures without memory leaks
- [ ] Documentation includes MCP tool examples for Copilot
- [ ] VSIX package includes bundled `server.js`
- [ ] README updated with MCP capabilities section
- [ ] Security review of credential handling

---

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [VS Code MCP API](https://code.visualstudio.com/api/extension-guides/ai/mcp)
- [HAR Spec 1.2](http://www.softwareishard.com/blog/har-12-spec/)
- [Dev Proxy MCP Example](https://github.com/dev-proxy-tools/mcp)
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

---

**Next Steps:**

1. Create `src/mcp/analyzer/` directory structure
2. Implement `HARParser.ts` with unit tests
3. Set up MCP server skeleton in `src/mcp/server.ts`
4. Test with MCP Inspector before VS Code integration

**Questions/Decisions Needed:**

- Should we support HAR 1.1 format in addition to 1.2?
- Maximum in-memory buffer size for live tracking (currently 10,000 entries)?
- Should navigate command open in preview mode or regular editor?
- Bundle MCP server as separate npm package or keep extension-internal?
