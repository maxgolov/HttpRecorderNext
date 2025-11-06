import { LiveHARTracker } from '@mcp/analyzer/LiveHARTracker';
import type { HAREntry } from '@mcp/analyzer/types';
import { beforeEach, describe, expect, it } from 'vitest';

describe('LiveHARTracker', () => {
  let tracker: LiveHARTracker;

  beforeEach(() => {
    tracker = new LiveHARTracker();
    tracker.startSession('test-session'); // Start session for tests
  });

  describe('add', () => {
    it('should add entry to buffer', () => {
      const entry = createMockEntry('https://example.com/a', 200);
      tracker.add(entry);

      expect(tracker.count).toBe(1);
      expect(tracker.getAll()).toContain(entry);
    });

    it('should add multiple entries', () => {
      const entry1 = createMockEntry('https://example.com/a', 200);
      const entry2 = createMockEntry('https://example.com/b', 200);
      
      tracker.add(entry1);
      tracker.add(entry2);

      expect(tracker.count).toBe(2);
      expect(tracker.getAll()).toEqual([entry1, entry2]);
    });

    it('should trim oldest entries when exceeding max', () => {
      const customTracker = new LiveHARTracker(5);
      customTracker.startSession('test-trim');

      for (let i = 0; i < 7; i++) {
        customTracker.add(createMockEntry(`https://example.com/${i}`, 200));
      }

      expect(customTracker.count).toBe(5);
      const urls = customTracker.getAll().map((e: HAREntry) => e.request.url);
      expect(urls).not.toContain('https://example.com/0'); // Oldest removed
      expect(urls).not.toContain('https://example.com/1');
      expect(urls).toContain('https://example.com/6'); // Newest kept
    });
  });

  describe('getAll', () => {
    it('should return copy of entries array', () => {
      const entry = createMockEntry('https://example.com/a', 200);
      tracker.add(entry);

      const entries = tracker.getAll();
      entries.push(createMockEntry('https://example.com/b', 200));

      expect(tracker.count).toBe(1); // Original not modified
    });

    it('should return empty array when no entries', () => {
      expect(tracker.getAll()).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      tracker.add(createMockEntry('https://example.com/a', 200));
      tracker.add(createMockEntry('https://example.com/b', 200));
      
      tracker.clear();

      expect(tracker.count).toBe(0);
      expect(tracker.getAll()).toEqual([]);
    });
  });

  describe('toHAR', () => {
    it('should export as valid HAR structure', () => {
      const entry1 = createMockEntry('https://example.com/a', 200);
      const entry2 = createMockEntry('https://example.com/b', 404);
      
      tracker.add(entry1);
      tracker.add(entry2);

      const har = tracker.toHAR();

      expect(har.log.version).toBe('1.2');
      expect(har.log.creator.name).toBe('Traffic Cop');
      expect(har.log.creator.version).toBe('0.7.0');
      expect(har.log.entries).toHaveLength(2);
      expect(har.log.entries).toEqual([entry1, entry2]);
    });

    it('should export empty HAR when no entries', () => {
      const har = tracker.toHAR();

      expect(har.log.entries).toEqual([]);
    });
  });

  describe('count', () => {
    it('should return correct entry count', () => {
      expect(tracker.count).toBe(0);

      tracker.add(createMockEntry('https://example.com/a', 200));
      expect(tracker.count).toBe(1);

      tracker.add(createMockEntry('https://example.com/b', 200));
      expect(tracker.count).toBe(2);

      tracker.clear();
      expect(tracker.count).toBe(0);
    });
  });

  describe('getLatest', () => {
    it('should return most recent entries', () => {
      for (let i = 0; i < 10; i++) {
        tracker.add(createMockEntry(`https://example.com/${i}`, 200));
      }

      const latest = tracker.getLatest(3);

      expect(latest).toHaveLength(3);
      expect(latest[0].request.url).toBe('https://example.com/7');
      expect(latest[1].request.url).toBe('https://example.com/8');
      expect(latest[2].request.url).toBe('https://example.com/9');
    });

    it('should return all entries if count exceeds total', () => {
      tracker.add(createMockEntry('https://example.com/a', 200));
      tracker.add(createMockEntry('https://example.com/b', 200));

      const latest = tracker.getLatest(10);

      expect(latest).toHaveLength(2);
    });

    it('should return empty array when no entries', () => {
      expect(tracker.getLatest(5)).toEqual([]);
    });
  });

  describe('getSummary', () => {
    it('should return summary statistics', () => {
      tracker.add(createMockEntryWithDuration('https://example.com/a', 200, 100));
      tracker.add(createMockEntryWithDuration('https://example.com/b', 404, 200));
      tracker.add(createMockEntryWithSize('https://example.com/c', 5000));

      const summary = tracker.getSummary();

      expect(summary.totalRequests).toBe(3);
      expect(summary.totalDuration).toBe(400); // 100 + 200 + 100 (default)
      expect(summary.avgDuration).toBe(400 / 3);
      expect(summary.statusCodes.size).toBe(2);
      expect(summary.statusCodes.get(200)).toBe(2);
      expect(summary.statusCodes.get(404)).toBe(1);
    });

    it('should handle empty tracker', () => {
      const summary = tracker.getSummary();

      expect(summary.totalRequests).toBe(0);
      expect(summary.totalDuration).toBe(0);
      expect(summary.avgDuration).toBe(0);
      expect(summary.statusCodes.size).toBe(0);
    });
  });

  describe('maxEntries configuration', () => {
    it('should use default max of 10000', () => {
      const defaultTracker = new LiveHARTracker();
      
      for (let i = 0; i < 10005; i++) {
        defaultTracker.add(createMockEntry(`https://example.com/${i}`, 200));
      }

      expect(defaultTracker.count).toBe(10000);
    });

    it('should accept custom max entries', () => {
      const customTracker = new LiveHARTracker(100);

      for (let i = 0; i < 150; i++) {
        customTracker.add(createMockEntry(`https://example.com/${i}`, 200));
      }

      expect(customTracker.count).toBe(100);
    });
  });
});

// Helper functions
function createMockEntry(url: string, status: number): HAREntry {
  return {
    startedDateTime: '2025-11-05T12:00:00.000Z',
    time: 100,
    request: {
      method: 'GET',
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
        size: 1000,
        mimeType: 'application/json'
      },
      redirectURL: '',
      headersSize: 150,
      bodySize: 1000
    },
    cache: {},
    timings: {
      send: 10,
      wait: 80,
      receive: 10
    }
  };
}

function createMockEntryWithDuration(url: string, status: number, duration: number): HAREntry {
  const entry = createMockEntry(url, status);
  entry.time = duration;
  return entry;
}

function createMockEntryWithSize(url: string, size: number): HAREntry {
  const entry = createMockEntry(url, 200);
  entry.response.content.size = size;
  entry.response.bodySize = size;
  return entry;
}
