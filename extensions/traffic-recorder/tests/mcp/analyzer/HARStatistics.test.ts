import { describe, expect, it } from 'vitest';
import { HARStatistics } from '../../../src/mcp/analyzer/HARStatistics';
import type { HAREntry } from '../../../src/mcp/analyzer/types';

describe('HARStatistics', () => {
  describe('groupByStatus', () => {
    it('should group entries by status code', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/2', 200, 'GET', 150, 2000),
        createMockEntry('https://api.example.com/3', 404, 'GET', 50, 500),
        createMockEntry('https://api.example.com/4', 500, 'POST', 200, 3000)
      ];

      const stats = HARStatistics.groupByStatus(entries);

      expect(stats).toHaveLength(3);
      
      const ok = stats.find(s => s.code === 200);
      expect(ok).toBeDefined();
      expect(ok!.count).toBe(2);
      expect(ok!.avgDuration).toBe(125);
      expect(ok!.minDuration).toBe(100);
      expect(ok!.maxDuration).toBe(150);
      expect(ok!.totalSize).toBe(3000);
      expect(ok!.urls).toHaveLength(2);

      const notFound = stats.find(s => s.code === 404);
      expect(notFound).toBeDefined();
      expect(notFound!.count).toBe(1);
      expect(notFound!.avgDuration).toBe(50);

      const serverError = stats.find(s => s.code === 500);
      expect(serverError).toBeDefined();
      expect(serverError!.count).toBe(1);
    });

    it('should sort by count descending', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/2', 404, 'GET', 50, 500),
        createMockEntry('https://api.example.com/3', 404, 'GET', 60, 600),
        createMockEntry('https://api.example.com/4', 404, 'GET', 70, 700)
      ];

      const stats = HARStatistics.groupByStatus(entries);

      expect(stats[0].code).toBe(404); // Most common
      expect(stats[0].count).toBe(3);
      expect(stats[1].code).toBe(200);
      expect(stats[1].count).toBe(1);
    });

    it('should handle empty entries', () => {
      const stats = HARStatistics.groupByStatus([]);
      expect(stats).toEqual([]);
    });
  });

  describe('groupBySize', () => {
    it('should group entries by size ranges', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 500),        // 0-1KB
        createMockEntry('https://api.example.com/2', 200, 'GET', 100, 2048),       // 1KB-10KB
        createMockEntry('https://api.example.com/3', 200, 'GET', 100, 50000),      // 10KB-100KB
        createMockEntry('https://api.example.com/4', 200, 'GET', 100, 500000),     // 100KB-1MB
        createMockEntry('https://api.example.com/5', 200, 'GET', 100, 2000000),    // 1MB-10MB
        createMockEntry('https://api.example.com/6', 200, 'GET', 100, 20000000)    // 10MB+
      ];

      const stats = HARStatistics.groupBySize(entries);

      expect(stats).toHaveLength(6);
      
      const smallRange = stats.find(s => s.sizeRange === '0-1KB');
      expect(smallRange).toBeDefined();
      expect(smallRange!.count).toBe(1);

      const largeRange = stats.find(s => s.sizeRange === '10MB+');
      expect(largeRange).toBeDefined();
      expect(largeRange!.count).toBe(1);
    });

    it('should calculate average size correctly', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 100),
        createMockEntry('https://api.example.com/2', 200, 'GET', 100, 200),
        createMockEntry('https://api.example.com/3', 200, 'GET', 100, 300)
      ];

      const stats = HARStatistics.groupBySize(entries);
      const range = stats.find(s => s.sizeRange === '0-1KB');
      
      expect(range!.avgSize).toBe(200);
      expect(range!.totalSize).toBe(600);
    });

    it('should filter out empty ranges', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 500)  // Only 0-1KB
      ];

      const stats = HARStatistics.groupBySize(entries);

      expect(stats).toHaveLength(1);
      expect(stats[0].sizeRange).toBe('0-1KB');
    });
  });

  describe('groupByDuration', () => {
    it('should group entries by duration ranges', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 50, 1000),       // 0-100ms
        createMockEntry('https://api.example.com/2', 200, 'GET', 250, 1000),      // 100-500ms
        createMockEntry('https://api.example.com/3', 200, 'GET', 750, 1000),      // 500ms-1s
        createMockEntry('https://api.example.com/4', 200, 'GET', 2000, 1000),     // 1s-5s
        createMockEntry('https://api.example.com/5', 200, 'GET', 7000, 1000),     // 5s-10s
        createMockEntry('https://api.example.com/6', 200, 'GET', 15000, 1000)     // 10s+
      ];

      const stats = HARStatistics.groupByDuration(entries);

      expect(stats).toHaveLength(6);
      expect(stats.find(s => s.durationRange === '0-100ms')!.count).toBe(1);
      expect(stats.find(s => s.durationRange === '10s+')!.count).toBe(1);
    });

    it('should calculate average duration correctly', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/2', 200, 'GET', 200, 1000),
        createMockEntry('https://api.example.com/3', 200, 'GET', 300, 1000)
      ];

      const stats = HARStatistics.groupByDuration(entries);
      const range = stats.find(s => s.durationRange === '100-500ms');
      
      expect(range!.avgDuration).toBe(200);
      expect(range!.totalDuration).toBe(600);
    });
  });

  describe('findAuthFailures', () => {
    it('should find 401 and 403 responses', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/2', 401, 'GET', 50, 500),
        createMockEntry('https://api.example.com/3', 403, 'POST', 60, 600),
        createMockEntry('https://api.example.com/4', 404, 'GET', 70, 700)
      ];

      const failures = HARStatistics.findAuthFailures(entries);

      expect(failures).toHaveLength(2);
      expect(failures[0].status).toBe(401);
      expect(failures[1].status).toBe(403);
    });

    it('should include auth header info', () => {
      const entry = createMockEntry('https://api.example.com', 401, 'GET', 100, 1000);
      entry.request.headers = [
        { name: 'Authorization', value: 'Bearer token123' }
      ];
      entry.request.cookies = [
        { name: 'session', value: 'abc' },
        { name: 'user', value: 'xyz' }
      ];

      const failures = HARStatistics.findAuthFailures([entry]);

      expect(failures[0].authHeader).toBe(true);
      expect(failures[0].cookieCount).toBe(2);
    });

    it('should detect missing auth header', () => {
      const entry = createMockEntry('https://api.example.com', 403, 'GET', 100, 1000);
      
      const failures = HARStatistics.findAuthFailures([entry]);

      expect(failures[0].authHeader).toBe(false);
      expect(failures[0].cookieCount).toBe(0);
    });
  });

  describe('groupByMethod', () => {
    it('should group entries by HTTP method', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/2', 200, 'GET', 150, 2000),
        createMockEntry('https://api.example.com/3', 201, 'POST', 200, 3000),
        createMockEntry('https://api.example.com/4', 400, 'POST', 50, 500)
      ];

      const stats = HARStatistics.groupByMethod(entries);

      expect(stats).toHaveLength(2);
      
      const getStats = stats.find(s => s.method === 'GET');
      expect(getStats!.count).toBe(2);
      expect(getStats!.successCount).toBe(2);
      expect(getStats!.failureCount).toBe(0);

      const postStats = stats.find(s => s.method === 'POST');
      expect(postStats!.count).toBe(2);
      expect(postStats!.successCount).toBe(1);
      expect(postStats!.failureCount).toBe(1);
    });

    it('should normalize method to uppercase', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'get', 100, 1000),
        createMockEntry('https://api.example.com/2', 200, 'GET', 150, 2000)
      ];

      const stats = HARStatistics.groupByMethod(entries);

      expect(stats).toHaveLength(1);
      expect(stats[0].method).toBe('GET');
      expect(stats[0].count).toBe(2);
    });
  });

  describe('calculateDurationPercentiles', () => {
    it('should calculate percentiles correctly', () => {
      const entries = Array.from({ length: 100 }, (_, i) =>
        createMockEntry(`https://api.example.com/${i}`, 200, 'GET', i * 10, 1000)
      );

      const percentiles = HARStatistics.calculateDurationPercentiles(entries);

      expect(percentiles.p50).toBeCloseTo(490, -1);
      expect(percentiles.p75).toBeCloseTo(740, -1);
      expect(percentiles.p90).toBeCloseTo(890, -1);
      expect(percentiles.p95).toBeCloseTo(940, -1);
      expect(percentiles.p99).toBeCloseTo(980, -1);
    });

    it('should handle custom percentiles', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/2', 200, 'GET', 200, 1000),
        createMockEntry('https://api.example.com/3', 200, 'GET', 300, 1000)
      ];

      const percentiles = HARStatistics.calculateDurationPercentiles(entries, [33, 66]);

      expect(percentiles.p33).toBe(100);
      expect(percentiles.p66).toBe(200);
    });

    it('should return empty object for no entries', () => {
      const percentiles = HARStatistics.calculateDurationPercentiles([]);
      expect(percentiles).toEqual({});
    });
  });

  describe('findSlowest', () => {
    it('should find slowest requests', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/2', 200, 'GET', 500, 1000),
        createMockEntry('https://api.example.com/3', 200, 'GET', 200, 1000),
        createMockEntry('https://api.example.com/4', 200, 'GET', 1000, 1000)
      ];

      const slowest = HARStatistics.findSlowest(entries, 2);

      expect(slowest).toHaveLength(2);
      expect(slowest[0].duration).toBe(1000);
      expect(slowest[1].duration).toBe(500);
    });
  });

  describe('findLargest', () => {
    it('should find largest responses', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/2', 200, 'GET', 100, 5000),
        createMockEntry('https://api.example.com/3', 200, 'GET', 100, 2000),
        createMockEntry('https://api.example.com/4', 200, 'GET', 100, 10000)
      ];

      const largest = HARStatistics.findLargest(entries, 2);

      expect(largest).toHaveLength(2);
      expect(largest[0].size).toBe(10000);
      expect(largest[1].size).toBe(5000);
    });
  });

  describe('calculateTotalBandwidth', () => {
    it('should calculate total bandwidth', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'POST', 100, 1000),
        createMockEntry('https://api.example.com/2', 200, 'POST', 100, 2000)
      ];
      
      entries[0].request.bodySize = 500;
      entries[1].request.bodySize = 1000;

      const bandwidth = HARStatistics.calculateTotalBandwidth(entries);

      expect(bandwidth.requestBytes).toBe(1500);
      expect(bandwidth.responseBytes).toBe(3000);
      expect(bandwidth.totalBytes).toBe(4500);
      expect(bandwidth.totalMB).toBeCloseTo(0.00429, 5);
    });
  });

  describe('getTimeRange', () => {
    it('should calculate time range of capture', () => {
      const entries = [
        createMockEntry('https://api.example.com/1', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/2', 200, 'GET', 100, 1000),
        createMockEntry('https://api.example.com/3', 200, 'GET', 100, 1000)
      ];

      entries[0].startedDateTime = '2025-11-05T12:00:00.000Z';
      entries[1].startedDateTime = '2025-11-05T12:00:05.000Z';
      entries[2].startedDateTime = '2025-11-05T12:00:10.000Z';

      const timeRange = HARStatistics.getTimeRange(entries);

      expect(timeRange).not.toBeNull();
      expect(timeRange!.start).toBe('2025-11-05T12:00:00.000Z');
      expect(timeRange!.end).toBe('2025-11-05T12:00:10.000Z');
      expect(timeRange!.durationMs).toBe(10000);
    });

    it('should return null for empty entries', () => {
      const timeRange = HARStatistics.getTimeRange([]);
      expect(timeRange).toBeNull();
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
): HAREntry {
  return {
    startedDateTime: '2025-11-05T12:00:00.000Z',
    time: duration,
    request: {
      method,
      url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      queryString: [],
      headersSize: 200,
      bodySize: 0
    },
    response: {
      status,
      statusText: 'OK',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: [],
      content: {
        size,
        mimeType: 'application/json'
      },
      redirectURL: '',
      headersSize: 150,
      bodySize: size
    },
    cache: {},
    timings: {
      send: 10,
      wait: duration - 20,
      receive: 10
    }
  };
}
