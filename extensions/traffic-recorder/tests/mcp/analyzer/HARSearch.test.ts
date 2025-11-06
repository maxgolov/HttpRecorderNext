import { HARSearch } from '@mcp/analyzer/HARSearch';
import type { HAREntry } from '@mcp/analyzer/types';
import { describe, expect, it } from 'vitest';

describe('HARSearch', () => {
  describe('search', () => {
    it('should find entries by URL substring', () => {
      const entries: HAREntry[] = [
        createMockEntry('https://api.example.com/users', 200),
        createMockEntry('https://api.example.com/posts', 200),
        createMockEntry('https://cdn.example.com/image.png', 200)
      ];

      const results = HARSearch.search(entries, { url: 'api.example.com' });

      expect(results).toHaveLength(2);
      expect(results[0].entry.request.url).toContain('api.example.com');
      expect(results[0].matchReason).toContain('URL contains "api.example.com"');
    });

    it('should find entries by URL regex', () => {
      const entries: HAREntry[] = [
        createMockEntry('https://api.example.com/users/123', 200),
        createMockEntry('https://api.example.com/users/456', 200),
        createMockEntry('https://api.example.com/posts', 200)
      ];

      const results = HARSearch.search(entries, { urlRegex: '/users/\\d+' });

      expect(results).toHaveLength(2);
      expect(results[0].matchReason).toContain('URL matches regex');
    });

    it('should find entries by HTTP method', () => {
      const entries: HAREntry[] = [
        createMockEntryWithMethod('https://api.example.com/users', 200, 'POST'),
        createMockEntryWithMethod('https://api.example.com/users', 200, 'GET'),
        createMockEntryWithMethod('https://api.example.com/users/1', 200, 'PUT')
      ];

      const results = HARSearch.search(entries, { method: 'POST' });

      expect(results).toHaveLength(1);
      expect(results[0].entry.request.method).toBe('POST');
    });

    it('should find entries by exact status code', () => {
      const entries: HAREntry[] = [
        createMockEntry('https://example.com/a', 200),
        createMockEntry('https://example.com/b', 404),
        createMockEntry('https://example.com/c', 500)
      ];

      const results = HARSearch.search(entries, { statusCode: 404 });

      expect(results).toHaveLength(1);
      expect(results[0].entry.response.status).toBe(404);
    });

    it('should find entries by status code range', () => {
      const entries: HAREntry[] = [
        createMockEntry('https://example.com/a', 200),
        createMockEntry('https://example.com/b', 400),
        createMockEntry('https://example.com/c', 404),
        createMockEntry('https://example.com/d', 500)
      ];

      const results = HARSearch.search(entries, { statusRange: [400, 499] });

      expect(results).toHaveLength(2);
      expect(results.every((r: any) => r.entry.response.status >= 400 && r.entry.response.status <= 499)).toBe(true);
    });

    it('should find entries by duration range', () => {
      const entries: HAREntry[] = [
        createMockEntryWithDuration('https://example.com/fast', 200, 50),
        createMockEntryWithDuration('https://example.com/medium', 200, 500),
        createMockEntryWithDuration('https://example.com/slow', 200, 5000)
      ];

      const results = HARSearch.search(entries, { 
        minDuration: 100,
        maxDuration: 1000
      });

      expect(results).toHaveLength(1);
      expect(results[0].entry.request.url).toContain('medium');
    });

    it('should find entries by size range', () => {
      const entries: HAREntry[] = [
        createMockEntryWithSize('https://example.com/small', 100),
        createMockEntryWithSize('https://example.com/medium', 5000),
        createMockEntryWithSize('https://example.com/large', 50000)
      ];

      const results = HARSearch.search(entries, {
        minSize: 1000,
        maxSize: 10000
      });

      expect(results).toHaveLength(1);
      expect(results[0].entry.request.url).toContain('medium');
    });

    it('should find entries by header presence', () => {
      const entries: HAREntry[] = [
        createMockEntryWithHeader('https://example.com/a', 200, 'Authorization', 'Bearer token123'),
        createMockEntryWithHeader('https://example.com/b', 200, 'Content-Type', 'application/json'),
        createMockEntry('https://example.com/c', 200)
      ];

      const results = HARSearch.search(entries, {
        headers: { 'Authorization': 'Bearer' }
      });

      expect(results).toHaveLength(1);
      expect(results[0].entry.request.url).toContain('/a');
    });

    it('should find entries with request body', () => {
      const entry1 = createMockEntry('https://example.com/a', 200);
      entry1.request.postData = { mimeType: 'application/json', text: '{"key":"value"}' };
      
      const entry2 = createMockEntry('https://example.com/b', 200);

      const results = HARSearch.search([entry1, entry2], { hasRequestBody: true });

      expect(results).toHaveLength(1);
      expect(results[0].entry.request.url).toContain('/a');
    });

    it('should find entries with response body', () => {
      const entry1 = createMockEntry('https://example.com/a', 200);
      entry1.response.content.text = '{"result":"success"}';
      
      const entry2 = createMockEntry('https://example.com/b', 204);

      const results = HARSearch.search([entry1, entry2], { hasResponseBody: true });

      expect(results).toHaveLength(1);
      expect(results[0].entry.request.url).toContain('/a');
    });

    it('should combine multiple criteria (AND logic)', () => {
      const entries: HAREntry[] = [
        createMockEntryWithMethod('https://api.example.com/users', 404, 'GET'),
        createMockEntryWithMethod('https://api.example.com/posts', 200, 'POST'),
        createMockEntryWithMethod('https://api.example.com/users', 200, 'GET')
      ];

      const results = HARSearch.search(entries, {
        url: '/users',
        method: 'GET',
        statusCode: 200
      });

      expect(results).toHaveLength(1);
      expect(results[0].entry.request.url).toContain('/users');
      expect(results[0].entry.request.method).toBe('GET');
      expect(results[0].entry.response.status).toBe(200);
    });

    it('should include match reasons', () => {
      const entries: HAREntry[] = [
        createMockEntryWithMethod('https://api.example.com/users', 404, 'POST')
      ];

      const results = HARSearch.search(entries, {
        url: 'api.example.com',
        method: 'POST',
        statusCode: 404
      });

      expect(results[0].matchReason).toHaveLength(3);
      expect(results[0].matchReason).toContain('URL contains "api.example.com"');
      expect(results[0].matchReason).toContain('Method is POST');
      expect(results[0].matchReason).toContain('Status code is 404');
    });

    it('should include original index', () => {
      const entries: HAREntry[] = [
        createMockEntry('https://example.com/a', 200),
        createMockEntry('https://example.com/b', 404),
        createMockEntry('https://example.com/c', 200)
      ];

      const results = HARSearch.search(entries, { statusCode: 404 });

      expect(results[0].index).toBe(1);
    });

    it('should return empty array when no matches', () => {
      const entries: HAREntry[] = [
        createMockEntry('https://example.com/a', 200)
      ];

      const results = HARSearch.search(entries, { statusCode: 404 });

      expect(results).toHaveLength(0);
    });
  });

  describe('byURL', () => {
    it('should search by URL substring', () => {
      const entries: HAREntry[] = [
        createMockEntry('https://api.example.com/users', 200),
        createMockEntry('https://cdn.example.com/image.png', 200)
      ];

      const results = HARSearch.byURL(entries, 'api.example.com');

      expect(results).toHaveLength(1);
      expect(results[0].entry.request.url).toContain('api.example.com');
    });

    it('should search by URL regex when regex=true', () => {
      const entries: HAREntry[] = [
        createMockEntry('https://api.example.com/users/123', 200),
        createMockEntry('https://api.example.com/posts', 200)
      ];

      const results = HARSearch.byURL(entries, '/users/\\d+', true);

      expect(results).toHaveLength(1);
    });
  });

  describe('findFailures', () => {
    it('should find all 4xx and 5xx errors', () => {
      const entries: HAREntry[] = [
        createMockEntry('https://example.com/a', 200),
        createMockEntry('https://example.com/b', 400),
        createMockEntry('https://example.com/c', 404),
        createMockEntry('https://example.com/d', 500),
        createMockEntry('https://example.com/e', 503)
      ];

      const results = HARSearch.findFailures(entries);

      expect(results).toHaveLength(4);
      expect(results.every((r: any) => r.entry.response.status >= 400)).toBe(true);
    });
  });

  describe('findSlow', () => {
    it('should find requests above threshold', () => {
      const entries: HAREntry[] = [
        createMockEntryWithDuration('https://example.com/fast', 200, 100),
        createMockEntryWithDuration('https://example.com/slow1', 200, 1500),
        createMockEntryWithDuration('https://example.com/slow2', 200, 3000)
      ];

      const results = HARSearch.findSlow(entries, 1000);

      expect(results).toHaveLength(2);
      expect(results.every((r: any) => r.entry.time >= 1000)).toBe(true);
    });

    it('should use default threshold of 1000ms', () => {
      const entries: HAREntry[] = [
        createMockEntryWithDuration('https://example.com/fast', 200, 500),
        createMockEntryWithDuration('https://example.com/slow', 200, 1500)
      ];

      const results = HARSearch.findSlow(entries);

      expect(results).toHaveLength(1);
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

function createMockEntryWithMethod(url: string, status: number, method: string): HAREntry {
  const entry = createMockEntry(url, status);
  entry.request.method = method;
  return entry;
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

function createMockEntryWithHeader(url: string, status: number, headerName: string, headerValue: string): HAREntry {
  const entry = createMockEntry(url, status);
  entry.request.headers.push({ name: headerName, value: headerValue });
  return entry;
}
