#!/usr/bin/env node

/**
 * MCP Server for Traffic Cop - HAR Analysis Tools
 * Provides AI assistants with HTTP traffic analysis capabilities
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile, readdir, stat, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { HARParser } from './analyzer/HARParser.js';
import { HARSearch } from './analyzer/HARSearch.js';
import { HARStatistics } from './analyzer/HARStatistics.js';
import { LiveHARTracker } from './analyzer/LiveHARTracker.js';
import type { HAR, HAREntry } from './analyzer/types.js';

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
  private server: Server;
  private config: ServerConfig;
  private liveTracker = new LiveHARTracker();

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: 'traffic-cop-mcp',
        version: '0.7.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerHandlers();
  }

  /**
   * Register MCP protocol handlers
   */
  private registerHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getToolDefinitions(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_captures':
            return await this.listCaptures(args);
          case 'get_capture_summary':
            return await this.getCaptureSummary(args);
          case 'get_statistics_by_status':
            return await this.getStatisticsByStatus(args);
          case 'get_statistics_by_size':
            return await this.getStatisticsBySize(args);
          case 'get_statistics_by_duration':
            return await this.getStatisticsByDuration(args);
          case 'find_authorization_failures':
            return await this.findAuthorizationFailures(args);
          case 'investigate_failures':
            return await this.investigateFailures(args);
          case 'search_requests':
            return await this.searchRequests(args);
          case 'navigate_to_request':
            return await this.navigateToRequest(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Get tool definitions for MCP protocol
   */
  private getToolDefinitions(): Tool[] {
    return [
      {
        name: 'list_captures',
        description: 'List all HAR capture files in the recordings directory. Optionally filter by filename pattern.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Optional glob pattern to filter filenames (e.g., "session_*.har")',
            },
          },
        },
      },
      {
        name: 'get_capture_summary',
        description: 'Get summary statistics for a HAR capture file. Use "latest" for most recent, "live" for active capture, or specific filename.',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'HAR filename, "latest", or "live"',
            },
          },
          required: ['filename'],
        },
      },
      {
        name: 'get_statistics_by_status',
        description: 'Group HTTP requests by status code (200, 404, 500, etc.) with counts and durations.',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'HAR filename, "latest", or "live"',
            },
          },
          required: ['filename'],
        },
      },
      {
        name: 'get_statistics_by_size',
        description: 'Group HTTP requests by payload size ranges (0-1KB, 1KB-10KB, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'HAR filename, "latest", or "live"',
            },
          },
          required: ['filename'],
        },
      },
      {
        name: 'get_statistics_by_duration',
        description: 'Group HTTP requests by response time ranges (0-100ms, 100ms-1s, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'HAR filename, "latest", or "live"',
            },
          },
          required: ['filename'],
        },
      },
      {
        name: 'find_authorization_failures',
        description: 'Find all authentication/authorization failures (401, 403 status codes).',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'HAR filename, "latest", or "live"',
            },
          },
          required: ['filename'],
        },
      },
      {
        name: 'investigate_failures',
        description: 'Find all failed requests (4xx and 5xx status codes) with detailed information.',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'HAR filename, "latest", or "live"',
            },
          },
          required: ['filename'],
        },
      },
      {
        name: 'search_requests',
        description: 'Advanced search for HTTP requests using multiple criteria (URL pattern, method, status, duration, size, headers).',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'HAR filename, "latest", or "live"',
            },
            criteria: {
              type: 'object',
              description: 'Search criteria',
              properties: {
                url: { type: 'string', description: 'URL substring match' },
                urlRegex: { type: 'string', description: 'URL regex pattern' },
                method: { type: 'string', description: 'HTTP method (GET, POST, etc.)' },
                statusCode: { type: 'number', description: 'Exact status code' },
                statusRange: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Status code range [min, max]',
                },
                minDuration: { type: 'number', description: 'Minimum duration in ms' },
                maxDuration: { type: 'number', description: 'Maximum duration in ms' },
                minSize: { type: 'number', description: 'Minimum size in bytes' },
                maxSize: { type: 'number', description: 'Maximum size in bytes' },
                headers: {
                  type: 'object',
                  description: 'Request headers to match (key-value pairs)',
                },
                contentType: { type: 'string', description: 'Response content type' },
              },
            },
          },
          required: ['filename', 'criteria'],
        },
      },
      {
        name: 'navigate_to_request',
        description: 'Navigate to a specific request in VS Code HAR viewer (VS Code only).',
        inputSchema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'HAR filename',
            },
            index: {
              type: 'number',
              description: 'Entry index (0-based)',
            },
          },
          required: ['filename', 'index'],
        },
      },
    ];
  }

  /**
   * List all HAR files
   */
  private async listCaptures(args: any) {
    const files = await this.listCaptureFiles(args.pattern);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(files, null, 2),
        },
      ],
    };
  }

  /**
   * Get capture summary
   */
  private async getCaptureSummary(args: any) {
    const { filename } = args;
    const har = await this.loadHAR(filename);
    const summary = this.generateSummary(har);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  /**
   * Get statistics by status code
   */
  private async getStatisticsByStatus(args: any) {
    const { filename } = args;
    const entries = await this.getEntries(filename);
    const stats = HARStatistics.groupByStatus(entries);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  /**
   * Get statistics by size
   */
  private async getStatisticsBySize(args: any) {
    const { filename } = args;
    const entries = await this.getEntries(filename);
    const stats = HARStatistics.groupBySize(entries);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  /**
   * Get statistics by duration
   */
  private async getStatisticsByDuration(args: any) {
    const { filename } = args;
    const entries = await this.getEntries(filename);
    const stats = HARStatistics.groupByDuration(entries);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  /**
   * Find authorization failures
   */
  private async findAuthorizationFailures(args: any) {
    const { filename } = args;
    const entries = await this.getEntries(filename);
    const failures = HARStatistics.findAuthFailures(entries);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(failures, null, 2),
        },
      ],
    };
  }

  /**
   * Investigate all failures
   */
  private async investigateFailures(args: any) {
    const { filename } = args;
    const entries = await this.getEntries(filename);
    const failures = HARSearch.findFailures(entries);
    
    const result = failures.map((r) => ({
      index: r.index,
      url: r.entry.request.url,
      method: r.entry.request.method,
      status: r.entry.response.status,
      statusText: r.entry.response.statusText,
      duration: r.entry.time,
      size: r.entry.response.content.size,
      timestamp: r.entry.startedDateTime,
      matchReasons: r.matchReasons,
    }));
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Search requests with criteria
   */
  private async searchRequests(args: any) {
    const { filename, criteria } = args;
    const entries = await this.getEntries(filename);
    
    // Convert statusRange array to tuple if present
    const searchCriteria = { ...criteria };
    if (criteria.statusRange && Array.isArray(criteria.statusRange)) {
      searchCriteria.statusRange = criteria.statusRange as [number, number];
    }
    
    const results = HARSearch.search(entries, searchCriteria);
    
    const formatted = results.map((r) => ({
      index: r.index,
      url: r.entry.request.url,
      method: r.entry.request.method,
      status: r.entry.response.status,
      duration: r.entry.time,
      size: r.entry.response.content.size,
      contentType: r.entry.response.content.mimeType,
      timestamp: r.entry.startedDateTime,
      matchReasons: r.matchReasons,
    }));
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formatted, null, 2),
        },
      ],
    };
  }

  /**
   * Navigate to request (returns navigation info for VS Code)
   */
  private async navigateToRequest(args: any) {
    const { filename, index } = args;
    
    // Validate file exists
    const fullPath = await this.resolveFilePath(filename);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            action: 'navigate',
            filePath: fullPath,
            entryIndex: index,
            message: `Navigate to entry ${index} in ${filename}`,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * List all HAR files in recordings directory
   */
  private async listCaptureFiles(pattern?: string): Promise<Array<{
    filename: string;
    size: number;
    modified: string;
  }>> {
    try {
      const files = await readdir(this.config.recordingsDir);
      const harFiles = files.filter((f) => f.endsWith('.har'));
      
      // Filter by pattern if provided
      const filtered = pattern
        ? harFiles.filter((f) => new RegExp(pattern).test(f))
        : harFiles;
      
      // Get file stats
      const details = await Promise.all(
        filtered.map(async (filename) => {
          const filePath = join(this.config.recordingsDir, filename);
          const stats = await stat(filePath);
          return {
            filename,
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        })
      );
      
      return details.sort((a, b) => b.modified.localeCompare(a.modified));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Load HAR file (supports "latest", "live", or specific filename)
   */
  private async loadHAR(filename: string): Promise<HAR> {
    if (filename === 'live') {
      if (!this.liveTracker.isSessionActive()) {
        throw new Error('No active live capture session');
      }
      return this.liveTracker.toHAR();
    }

    const filePath = await this.resolveFilePath(filename);
    let content = await readFile(filePath, 'utf-8');
    
    // Strip BOM (Byte Order Mark) if present - \uFEFF at start
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    
    // Try to parse - if it fails, attempt auto-repair
    try {
      return HARParser.parse(content);
    } catch (parseError) {
      // Attempt auto-repair for common issues
      const repaired = this.repairHARContent(content);
      if (repaired !== content) {
        try {
          const har = HARParser.parse(repaired);
          // Auto-save the repaired version
          await writeFile(filePath, repaired, 'utf-8');
          return har;
        } catch {
          // If repair didn't work, throw original error
          throw parseError;
        }
      }
      throw parseError;
    }
  }

  /**
   * Attempt to repair common HAR file corruption patterns
   */
  private repairHARContent(content: string): string {
    let repaired = content;
    
    // Fix pattern: }, , , { (extra commas between entries)
    repaired = repaired.replace(/\},\s*,+\s*\{/g, '},\n{');
    
    // Fix pattern: trailing commas before closing bracket
    repaired = repaired.replace(/,(\s*\])/g, '$1');
    
    // Fix missing closing brackets/braces by counting
    let openBraces = 0, closeBraces = 0;
    let openBrackets = 0, closeBrackets = 0;
    let inString = false, escapeNext = false;
    
    for (let i = 0; i < repaired.length; i++) {
      const char = repaired[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (char === '\\') { escapeNext = true; continue; }
      if (char === '"' && !escapeNext) { inString = !inString; continue; }
      if (inString) continue;
      
      if (char === '{') openBraces++;
      else if (char === '}') closeBraces++;
      else if (char === '[') openBrackets++;
      else if (char === ']') closeBrackets++;
    }
    
    const missingBrackets = openBrackets - closeBrackets;
    const missingBraces = openBraces - closeBraces;
    
    if (missingBrackets > 0 || missingBraces > 0) {
      repaired = repaired.trimEnd();
      if (repaired.endsWith(',')) repaired = repaired.slice(0, -1);
      for (let i = 0; i < missingBrackets; i++) repaired += '\n]';
      for (let i = 0; i < missingBraces; i++) repaired += '\n}';
    }
    
    return repaired;
  }

  /**
   * Resolve filename to full path
   */
  private async resolveFilePath(filename: string): Promise<string> {
    if (filename === 'latest') {
      const files = await this.listCaptureFiles();
      if (files.length === 0) {
        throw new Error('No HAR files found in recordings directory');
      }
      filename = files[0].filename;
    }

    const fullPath = resolve(this.config.recordingsDir, filename);
    
    // Security: prevent directory traversal
    if (!fullPath.startsWith(this.config.recordingsDir)) {
      throw new Error('Access denied: path outside recordings directory');
    }

    return fullPath;
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
  private generateSummary(har: HAR) {
    const entries = har.log.entries;
    const timeRange = HARStatistics.getTimeRange(entries);
    const bandwidth = HARStatistics.calculateTotalBandwidth(entries);
    const statusGroups = HARStatistics.groupByStatus(entries);
    const methodGroups = HARStatistics.groupByMethod(entries);
    const percentiles = HARStatistics.calculateDurationPercentiles(entries);

    return {
      filename: 'N/A',
      totalRequests: entries.length,
      timeRange,
      bandwidth,
      statusCodes: statusGroups.map((s) => ({
        code: s.code,
        count: s.count,
        avgDuration: Math.round(s.avgDuration),
      })),
      methods: methodGroups,
      durationPercentiles: percentiles,
      slowest: HARStatistics.findSlowest(entries, 5),
      largest: HARStatistics.findLargest(entries, 5),
    };
  }

  /**
   * Update live tracker (called by extension during active capture)
   */
  public addLiveEntry(entry: HAREntry): void {
    this.liveTracker.add(entry);
  }

  /**
   * Start live capture session
   */
  public startLiveCapture(sessionId: string): void {
    this.liveTracker.startSession(sessionId);
  }

  /**
   * Stop live capture session
   */
  public stopLiveCapture(): void {
    this.liveTracker.stopSession();
  }

  /**
   * Get live tracker instance (for external use)
   */
  public getLiveTracker(): LiveHARTracker {
    return this.liveTracker;
  }

  /**
   * Start the MCP server
   */
  async start() {
    if (this.config.transport === 'stdio') {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Traffic Cop MCP Server running on stdio');
    } else {
      throw new Error('HTTP transport not yet implemented');
    }
  }
}

// CLI entry point
const isMainModule = typeof require !== 'undefined' && require.main === module;

if (isMainModule) {
  const config: ServerConfig = {
    recordingsDir: process.env.RECORDINGS_DIR || '.http-recorder',
    transport: (process.env.TRANSPORT as 'stdio' | 'http') || 'stdio',
    httpPort: process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : undefined,
  };

  const server = new TrafficCopMCPServer(config);
  server.start().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

export { TrafficCopMCPServer };
export type { ServerConfig };

