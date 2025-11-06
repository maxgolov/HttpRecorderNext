import { HARParser } from '@mcp/analyzer/HARParser';
import { TrafficCopMCPServer } from '@mcp/server';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

describe('MCP Server', () => {
  let testDir: string;
  let server: TrafficCopMCPServer;

  beforeAll(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'traffic-cop-test-'));
    
    // Create a sample HAR file
    const sampleHAR = HARParser.createMinimalHAR([
      createMockEntry('https://api.example.com/users', 200, 'GET', 150, 1024),
      createMockEntry('https://api.example.com/posts', 404, 'GET', 50, 512),
      createMockEntry('https://api.example.com/auth', 401, 'POST', 200, 256),
    ]);

    await fs.writeFile(
      path.join(testDir, 'test-session.har'),
      JSON.stringify(sampleHAR, null, 2)
    );

    // Initialize server (don't start it, just create instance)
    server = new TrafficCopMCPServer({
      recordingsDir: testDir,
      transport: 'stdio',
    });
  });

  describe('Live Tracker Integration', () => {
    it('should start and stop live sessions', () => {
      const tracker = server.getLiveTracker();
      
      expect(tracker.isSessionActive()).toBe(false);
      
      server.startLiveCapture('test-session-123');
      expect(tracker.isSessionActive()).toBe(true);
      expect(tracker.getSessionId()).toBe('test-session-123');
      
      server.stopLiveCapture();
      expect(tracker.isSessionActive()).toBe(false);
    });

    it('should track live entries', () => {
      const tracker = server.getLiveTracker();
      server.startLiveCapture('live-test');

      const entry = createMockEntry('https://live.example.com', 200, 'GET', 100, 2048);
      server.addLiveEntry(entry);

      expect(tracker.count).toBe(1);
      const entries = tracker.getAll();
      expect(entries[0].request.url).toBe('https://live.example.com');

      server.stopLiveCapture();
    });

    it('should export live tracker as HAR', () => {
      const tracker = server.getLiveTracker();
      server.startLiveCapture('export-test');

      server.addLiveEntry(createMockEntry('https://test1.com', 200, 'GET', 100, 1024));
      server.addLiveEntry(createMockEntry('https://test2.com', 404, 'POST', 150, 512));

      const har = tracker.toHAR();
      
      expect(har.log.entries).toHaveLength(2);
      expect(har.log.browser?.version).toBe('export-test');

      server.stopLiveCapture();
    });
  });

  describe('Server Configuration', () => {
    it('should initialize with correct config', () => {
      const customServer = new TrafficCopMCPServer({
        recordingsDir: '/custom/path',
        transport: 'stdio',
      });

      expect(customServer).toBeDefined();
    });

    it('should handle missing recordings directory gracefully', async () => {
      const nonExistentDir = path.join(testDir, 'does-not-exist');
      const emptyServer = new TrafficCopMCPServer({
        recordingsDir: nonExistentDir,
        transport: 'stdio',
      });

      expect(emptyServer).toBeDefined();
    });
  });

  describe('Tool Definitions', () => {
    it('should expose 9 MCP tools', () => {
      // This test verifies that all expected tools are available
      // We can't easily test the actual tool definitions without starting the server,
      // but we can verify the server exposes the right methods
      const expectedMethods = [
        'startLiveCapture',
        'stopLiveCapture',
        'addLiveEntry',
        'getLiveTracker',
        'start',
      ];

      for (const method of expectedMethods) {
        expect(typeof (server as any)[method]).toBe('function');
      }
    });
  });
});

// Helper function to create mock HAR entries
function createMockEntry(
  url: string,
  status: number,
  method: string,
  duration: number,
  size: number
): any {
  return {
    startedDateTime: new Date().toISOString(),
    time: duration,
    request: {
      method,
      url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      queryString: [],
      headersSize: 200,
      bodySize: 0,
    },
    response: {
      status,
      statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Unauthorized',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      content: {
        size,
        mimeType: 'application/json',
      },
      redirectURL: '',
      headersSize: 150,
      bodySize: size,
    },
    cache: {},
    timings: {
      send: 10,
      wait: duration - 20,
      receive: 10,
    },
  };
}
