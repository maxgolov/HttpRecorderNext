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
import { spawn } from 'node:child_process';
import { join, resolve } from 'path';
import { repairHARContent } from '../utils/harRepair.js';
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
          // TEMPORARILY DISABLED: These control Dev Proxy's IsRecording flag,
          // which does NOT affect HttpRecorder plugin (always captures traffic).
          // Use start_proxy/stop_proxy to control the proxy process instead.
          // TODO: Modify HttpRecorder plugin to respect IsRecording flag, then re-enable.
          // case 'start_capture':
          //   return await this.startCapture(args);
          // case 'stop_capture':
          //   return await this.stopCapture(args);
          case 'start_proxy':
            return await this.startProxy(args);
          case 'stop_proxy':
            return await this.stopProxy(args);
          case 'proxy_status':
            return await this.getProxyStatus(args);
          case 'get_config':
            return await this.getConfig(args);
          case 'update_config':
            return await this.updateConfig(args);
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
                traceparent: {
                  type: 'string',
                  description: 'OpenTelemetry traceparent header - search by TraceId substring',
                },
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
      // TEMPORARILY DISABLED: These control Dev Proxy's IsRecording flag,
      // which does NOT affect HttpRecorder plugin (always captures traffic).
      // Use start_proxy/stop_proxy to control the proxy process instead.
      // TODO: Modify HttpRecorder plugin to respect IsRecording flag, then re-enable.
      // {
      //   name: 'start_capture',
      //   description: 'Start Dev Proxy recording session via REST API.',
      //   inputSchema: {
      //     type: 'object',
      //     properties: {
      //       host: {
      //         type: 'string',
      //         description: 'Dev Proxy API host (default: 127.0.0.1)',
      //       },
      //       apiPort: {
      //         type: 'number',
      //         description: 'Dev Proxy API port (default: 8897)',
      //       },
      //     },
      //     required: [],
      //   },
      // },
      // {
      //   name: 'stop_capture',
      //   description: 'Stop current Dev Proxy recording session via REST API.',
      //   inputSchema: {
      //     type: 'object',
      //     properties: {
      //       host: {
      //         type: 'string',
      //         description: 'Dev Proxy API host (default: 127.0.0.1)',
      //       },
      //       apiPort: {
      //         type: 'number',
      //         description: 'Dev Proxy API port (default: 8897)',
      //       },
      //     },
      //     required: [],
      //   },
      // },
      {
        name: 'start_proxy',
        description: 'Start Dev Proxy process in a detached background shell (no output visibility). HttpRecorder will begin capturing all HTTP traffic to HAR files. NOTE: If you are a Language Model running in VS Code (e.g., Claude, GPT-4, or other models via GitHub Copilot), PREFER using the Language Model tool "traffic-recorder_startProxyInTerminal" instead if available, as it starts the proxy in VS Code integrated terminal with visible output for better user experience. Only use this MCP tool for automation scenarios or when the Language Model tool is unavailable.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'stop_proxy',
        description: 'Stop Dev Proxy process gracefully via REST API. Current HAR recording will be saved. Same as clicking Stop button in VS Code.',
        inputSchema: {
          type: 'object',
          properties: {
            host: {
              type: 'string',
              description: 'Dev Proxy API host (default: 127.0.0.1)',
            },
            apiPort: {
              type: 'number',
              description: 'Dev Proxy API port (default: 8897)',
            },
          },
          required: [],
        },
      },
      {
        name: 'proxy_status',
        description: 'Get current Dev Proxy port, API port, and proxy state programmatically.',
        inputSchema: {
          type: 'object',
          properties: {
            host: {
              type: 'string',
              description: 'Dev Proxy API host (default: 127.0.0.1)',
            },
            apiPort: {
              type: 'number',
              description: 'Dev Proxy API port (default: 8897)',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_config',
        description: 'Get current Dev Proxy configuration including anonymizeSensitiveData setting.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'update_config',
        description: 'Update Dev Proxy configuration settings (e.g., anonymizeSensitiveData).',
        inputSchema: {
          type: 'object',
          properties: {
            anonymizeSensitiveData: {
              type: 'boolean',
              description: 'Enable or disable sensitive data anonymization',
            },
          },
          required: [],
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
    const content = await readFile(filePath, 'utf-8');
    
    // Use shared repair utility
    const repairResult = repairHARContent(content);
    
    if (!repairResult.success) {
      throw new Error(`Failed to load HAR file: ${repairResult.error}`);
    }
    
    // If repaired, save the fixed version
    if (repairResult.repaired) {
      await writeFile(filePath, repairResult.content, 'utf-8');
    }
    
    return HARParser.parse(repairResult.content);
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
   * Start Dev Proxy process (same as clicking Start button in VS Code)
   * HttpRecorder plugin will begin capturing all HTTP traffic to HAR files.
   * 
   * NOTE: This MCP tool starts the proxy in a separate, detached shell process.
   * This is optimal for AI automation since it doesn't require user interaction.
   * 
   * If you need to start the proxy in a VS Code integrated terminal instead 
   * (for interactive debugging or seeing live output), you should suggest the
   * user execute the VS Code command: traffic-recorder.startProxy
   * OR use the Language Model tool: traffic-recorder_startProxyInTerminal
   */
  private async startProxy(_args: any) {
    try {
      // Try beta first (default in extension), then fallback to stable
      // This matches extension's default behavior (useBetaVersion: true)
      let devProxyCommand = 'devproxy-beta';
      
      // Test if beta is available by trying to spawn with --version
      // If it fails, fallback to stable 'devproxy'
      try {
        const testChild = spawn(devProxyCommand, ['--version'], {
          shell: true,
          stdio: 'ignore'
        });
        await new Promise<void>((resolve, reject) => {
          testChild.on('error', reject);
          testChild.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error('Beta not found'));
          });
          setTimeout(() => reject(new Error('Timeout')), 2000);
        });
      } catch {
        // Beta not available, use stable
        devProxyCommand = 'devproxy';
      }
      
      // Spawn devproxy process with config from recordings directory
      // CRITICAL: Set cwd to recordings dir so relative paths work (matches extension)
      const args = ['--config-file', 'devproxyrc.json'];
      
      const child = spawn(devProxyCommand, args, {
        cwd: this.config.recordingsDir, // Run from .http-recorder directory
        shell: true, // Use shell to resolve command in PATH (critical!)
        detached: true,
        stdio: 'ignore'
      });
      
      child.unref(); // Allow parent to exit independently
      
      // Wait a bit for proxy to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify proxy is running
      try {
        const response = await fetch('http://127.0.0.1:8897/proxy', {
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                status: 'success',
                message: 'Dev Proxy started successfully in a separate background shell',
                pid: child.pid,
                proxyPort: 8080,
                apiPort: 8897,
                mode: 'detached',
                hint: 'HttpRecorder is now capturing all HTTP traffic to HAR files. The proxy runs independently in a separate process.',
                alternativeNote: 'To start the proxy in VS Code terminal with visible output, suggest using the traffic-recorder_startProxyInTerminal Language Model tool or the VS Code command: traffic-recorder.startProxy'
              }, null, 2)
            }]
          };
        }
      } catch {
        // Proxy might still be starting
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            message: 'Dev Proxy process started in a separate background shell',
            pid: child.pid,
            mode: 'detached',
            hint: 'Proxy is starting. Use proxy_status to check when it is ready.',
            alternativeNote: 'To start the proxy in VS Code terminal with visible output, suggest using the traffic-recorder_startProxyInTerminal Language Model tool or the VS Code command: traffic-recorder.startProxy'
          }, null, 2)
        }]
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            hint: 'Make sure Dev Proxy is installed. Run: npm install -g @microsoft/dev-proxy'
          }, null, 2)
        }]
      };
    }
  }

  /**
   * Stop Dev Proxy process gracefully via REST API
   * Current HAR recording will be saved.
   */
  private async stopProxy(args: any) {
    const host = args.host || '127.0.0.1';
    const apiPort = args.apiPort || 8897;
    
    try {
      const response = await fetch(`http://${host}:${apiPort}/proxy/stopProxy`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.status === 202 || response.ok) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Dev Proxy stop signal sent',
              hint: 'Proxy will shut down gracefully and save current HAR recording'
            }, null, 2)
          }]
        };
      }
      
      const errorText = await response.text();
      throw new Error(`Failed to stop proxy: ${response.status} ${errorText}`);
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
            hint: 'Make sure Dev Proxy is running. Check proxy_status first.'
          }, null, 2)
        }]
      };
    }
  }

  /**
   * Get Dev Proxy status via REST API
   */
  private async getProxyStatus(args: any) {
    const host = args.host || '127.0.0.1';
    const apiPort = args.apiPort || 8897;
    
    try {
      const response = await fetch(`http://${host}:${apiPort}/proxy`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get proxy status: ${response.status} ${errorText}`);
      }
      
      const proxyInfo = await response.json() as Record<string, any>;
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              proxyPort: proxyInfo.proxyPort || 8080,
              apiPort: apiPort,
              recording: proxyInfo.recording || false,
              asSystemProxy: proxyInfo.asSystemProxy || false,
              rate: proxyInfo.rate || null,
              proxyInfo
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
              hint: 'Make sure Dev Proxy is running. Use default ports: proxy=8080, api=8897'
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Get current Dev Proxy configuration
   */
  private async getConfig(_args: any) {
    try {
      const configPath = join(this.config.recordingsDir, 'devproxyrc.json');
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              config: {
                anonymizeSensitiveData: config.httpRecorder?.anonymizeSensitiveData ?? true,
                mode: config.httpRecorder?.mode || 'Record',
                includeBodies: config.httpRecorder?.includeBodies ?? true,
                port: config.port || 8080,
                record: config.record || false,
                // Include other relevant settings
                ...config
              }
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
              hint: 'Make sure devproxyrc.json exists in the recordings directory'
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Update Dev Proxy configuration
   */
  private async updateConfig(args: any) {
    try {
      const configPath = join(this.config.recordingsDir, 'devproxyrc.json');
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      
      // Update configuration properties
      if (args.anonymizeSensitiveData !== undefined) {
        if (!config.httpRecorder) {
          config.httpRecorder = {};
        }
        config.httpRecorder.anonymizeSensitiveData = args.anonymizeSensitiveData;
      }
      
      // Write back with pretty formatting
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Configuration updated successfully',
              updated: {
                anonymizeSensitiveData: config.httpRecorder?.anonymizeSensitiveData
              }
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
              hint: 'Make sure devproxyrc.json exists and is writable'
            }, null, 2),
          },
        ],
      };
    }
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

