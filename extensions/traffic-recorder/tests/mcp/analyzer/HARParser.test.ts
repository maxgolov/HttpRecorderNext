import { HARParser } from '@mcp/analyzer/HARParser';
import type { HAR, HAREntry } from '@mcp/analyzer/types';
import { describe, expect, it } from 'vitest';

describe('HARParser', () => {
  describe('parse', () => {
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
      expect(har.log.creator.name).toBe('Test');
      expect(har.log.entries).toEqual([]);
    });

    it('should throw on invalid JSON', () => {
      expect(() => HARParser.parse('{')).toThrow('Invalid JSON');
    });

    it('should throw on missing log object', () => {
      expect(() => HARParser.parse('{}')).toThrow('Invalid HAR format: missing log object');
    });

    it('should throw on missing entries array', () => {
      const json = JSON.stringify({
        log: { version: '1.2', creator: { name: 'Test', version: '1.0' } }
      });
      expect(() => HARParser.parse(json)).toThrow('log.entries must be an array');
    });

    it('should throw on non-array entries', () => {
      const json = JSON.stringify({
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          entries: 'not-an-array'
        }
      });
      expect(() => HARParser.parse(json)).toThrow('log.entries must be an array');
    });
  });

  describe('validate', () => {
    it('should validate correct HAR structure', () => {
      const har: HAR = {
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          entries: [
            createMockEntry('https://api.example.com/users', 200, 'GET')
          ]
        }
      };
      
      expect(() => HARParser.validate(har)).not.toThrow();
    });

    it('should throw on missing version', () => {
      const har = {
        log: {
          creator: { name: 'Test', version: '1.0' },
          entries: []
        }
      } as any;
      
      expect(() => HARParser.validate(har)).toThrow('missing log.version');
    });

    it('should throw on missing creator', () => {
      const har = {
        log: {
          version: '1.2',
          entries: []
        }
      } as any;
      
      expect(() => HARParser.validate(har)).toThrow('missing or incomplete log.creator');
    });

    it('should throw on incomplete creator', () => {
      const har = {
        log: {
          version: '1.2',
          creator: { name: 'Test' },
          entries: []
        }
      } as any;
      
      expect(() => HARParser.validate(har)).toThrow('missing or incomplete log.creator');
    });

    it('should throw on entry missing request', () => {
      const har = {
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          entries: [{ response: {}, startedDateTime: '2025-01-01T00:00:00Z', time: 100 }]
        }
      } as any;
      
      expect(() => HARParser.validate(har)).toThrow('missing request object');
    });

    it('should throw on entry missing response', () => {
      const har = {
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          entries: [{ 
            request: { method: 'GET', url: 'https://example.com' }, 
            startedDateTime: '2025-01-01T00:00:00Z', 
            time: 100 
          }]
        }
      } as any;
      
      expect(() => HARParser.validate(har)).toThrow('missing response object');
    });

    it('should throw on missing request.method', () => {
      const har = {
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          entries: [{
            request: { url: 'https://example.com' },
            response: { status: 200 },
            startedDateTime: '2025-01-01T00:00:00Z',
            time: 100
          }]
        }
      } as any;
      
      expect(() => HARParser.validate(har)).toThrow('missing request.method');
    });

    it('should throw on missing request.url', () => {
      const har = {
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          entries: [{
            request: { method: 'GET' },
            response: { status: 200 },
            startedDateTime: '2025-01-01T00:00:00Z',
            time: 100
          }]
        }
      } as any;
      
      expect(() => HARParser.validate(har)).toThrow('missing request.url');
    });
  });

  describe('getURL', () => {
    it('should extract URL from entry', () => {
      const entry = createMockEntry('https://api.example.com:8080/users?id=123', 200, 'GET');
      const url = HARParser.getURL(entry);
      
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('api.example.com');
      expect(url.port).toBe('8080');
      expect(url.pathname).toBe('/users');
      expect(url.searchParams.get('id')).toBe('123');
    });

    it('should throw on invalid URL', () => {
      const entry = createMockEntry('not-a-valid-url', 200, 'GET');
      expect(() => HARParser.getURL(entry)).toThrow('Invalid URL');
    });
  });

  describe('getHeader', () => {
    it('should find header case-insensitively', () => {
      const headers = [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Authorization', value: 'Bearer token123' }
      ];
      
      expect(HARParser.getHeader(headers, 'content-type')).toBe('application/json');
      expect(HARParser.getHeader(headers, 'CONTENT-TYPE')).toBe('application/json');
      expect(HARParser.getHeader(headers, 'authorization')).toBe('Bearer token123');
    });

    it('should return undefined for missing header', () => {
      const headers = [{ name: 'Content-Type', value: 'application/json' }];
      expect(HARParser.getHeader(headers, 'X-Custom-Header')).toBeUndefined();
    });
  });

  describe('getHeaders', () => {
    it('should return all values for duplicate headers', () => {
      const headers = [
        { name: 'Set-Cookie', value: 'session=abc' },
        { name: 'Content-Type', value: 'text/html' },
        { name: 'Set-Cookie', value: 'user=xyz' }
      ];
      
      const cookies = HARParser.getHeaders(headers, 'set-cookie');
      expect(cookies).toEqual(['session=abc', 'user=xyz']);
    });

    it('should return empty array for missing header', () => {
      const headers = [{ name: 'Content-Type', value: 'text/html' }];
      expect(HARParser.getHeaders(headers, 'X-Custom')).toEqual([]);
    });
  });

  describe('hasHeader', () => {
    it('should return true for existing header', () => {
      const headers = [{ name: 'Authorization', value: 'Bearer token' }];
      expect(HARParser.hasHeader(headers, 'authorization')).toBe(true);
      expect(HARParser.hasHeader(headers, 'AUTHORIZATION')).toBe(true);
    });

    it('should return false for missing header', () => {
      const headers = [{ name: 'Content-Type', value: 'text/html' }];
      expect(HARParser.hasHeader(headers, 'Authorization')).toBe(false);
    });
  });

  describe('isJSONResponse', () => {
    it('should detect JSON content type in mimeType', () => {
      const entry = createMockEntry('https://api.example.com', 200, 'GET');
      entry.response.content.mimeType = 'application/json';
      expect(HARParser.isJSONResponse(entry)).toBe(true);
    });

    it('should detect JSON content type with charset', () => {
      const entry = createMockEntry('https://api.example.com', 200, 'GET');
      entry.response.content.mimeType = 'application/json; charset=utf-8';
      expect(HARParser.isJSONResponse(entry)).toBe(true);
    });

    it('should return false for non-JSON', () => {
      const entry = createMockEntry('https://api.example.com', 200, 'GET');
      entry.response.content.mimeType = 'text/html';
      expect(HARParser.isJSONResponse(entry)).toBe(false);
    });
  });

  describe('getQueryParam', () => {
    it('should get query parameter value', () => {
      const entry = createMockEntry('https://api.example.com', 200, 'GET');
      entry.request.queryString = [
        { name: 'id', value: '123' },
        { name: 'sort', value: 'asc' }
      ];
      
      expect(HARParser.getQueryParam(entry, 'id')).toBe('123');
      expect(HARParser.getQueryParam(entry, 'sort')).toBe('asc');
    });

    it('should return undefined for missing parameter', () => {
      const entry = createMockEntry('https://api.example.com', 200, 'GET');
      entry.request.queryString = [{ name: 'id', value: '123' }];
      
      expect(HARParser.getQueryParam(entry, 'missing')).toBeUndefined();
    });
  });

  describe('getQueryParams', () => {
    it('should convert query params to object', () => {
      const entry = createMockEntry('https://api.example.com', 200, 'GET');
      entry.request.queryString = [
        { name: 'id', value: '123' },
        { name: 'sort', value: 'asc' },
        { name: 'limit', value: '10' }
      ];
      
      const params = HARParser.getQueryParams(entry);
      expect(params).toEqual({ id: '123', sort: 'asc', limit: '10' });
    });
  });

  describe('getCookie', () => {
    it('should get cookie value', () => {
      const entry = createMockEntry('https://api.example.com', 200, 'GET');
      entry.request.cookies = [
        { name: 'session', value: 'abc123' },
        { name: 'user', value: 'john' }
      ];
      
      expect(HARParser.getCookie(entry, 'session')).toBe('abc123');
      expect(HARParser.getCookie(entry, 'user')).toBe('john');
    });

    it('should return undefined for missing cookie', () => {
      const entry = createMockEntry('https://api.example.com', 200, 'GET');
      expect(HARParser.getCookie(entry, 'missing')).toBeUndefined();
    });
  });

  describe('formatEntry', () => {
    it('should format entry as readable string', () => {
      const entry = createMockEntry('https://api.example.com/users', 200, 'POST');
      entry.time = 150.5;
      entry.response.content.size = 1024;
      
      const formatted = HARParser.formatEntry(entry);
      expect(formatted).toContain('POST');
      expect(formatted).toContain('https://api.example.com/users');
      expect(formatted).toContain('200');
      expect(formatted).toContain('151ms');
      expect(formatted).toContain('1024 bytes');
    });
  });

  describe('createMinimalHAR', () => {
    it('should create minimal HAR with no entries', () => {
      const har = HARParser.createMinimalHAR();
      
      expect(har.log.version).toBe('1.2');
      expect(har.log.creator.name).toBe('Traffic Cop');
      expect(har.log.entries).toEqual([]);
    });

    it('should create minimal HAR with provided entries', () => {
      const entry = createMockEntry('https://example.com', 200, 'GET');
      const har = HARParser.createMinimalHAR([entry]);
      
      expect(har.log.entries).toHaveLength(1);
      expect(har.log.entries[0]).toBe(entry);
    });
  });

  describe('stringify', () => {
    it('should stringify HAR without formatting', () => {
      const har = HARParser.createMinimalHAR();
      const json = HARParser.stringify(har);
      
      expect(json).not.toContain('\n');
      expect(JSON.parse(json)).toEqual(har);
    });

    it('should stringify HAR with pretty printing', () => {
      const har = HARParser.createMinimalHAR();
      const json = HARParser.stringify(har, true);
      
      expect(json).toContain('\n');
      expect(json).toContain('  ');
      expect(JSON.parse(json)).toEqual(har);
    });
  });
});

// Helper function to create mock HAR entries
function createMockEntry(url: string, status: number, method: string): HAREntry {
  return {
    startedDateTime: '2025-11-05T12:00:00.000Z',
    time: 100,
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
