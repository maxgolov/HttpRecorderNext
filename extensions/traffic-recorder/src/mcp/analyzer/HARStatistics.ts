/**
 * HAR Statistics - Aggregation and analysis of HAR entries
 * Framework-agnostic, pure computation
 */

import type { HAREntry } from './types';

export interface StatusCodeStats {
  code: number;
  statusText: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  totalSize: number;
  avgSize: number;
  urls: string[];
}

export interface PayloadSizeStats {
  sizeRange: string;
  minBytes: number;
  maxBytes: number;
  count: number;
  totalSize: number;
  avgSize: number;
  urls: string[];
}

export interface DurationStats {
  durationRange: string;
  minMs: number;
  maxMs: number;
  count: number;
  totalDuration: number;
  avgDuration: number;
  urls: string[];
}

export interface AuthFailure {
  url: string;
  method: string;
  status: number;
  statusText: string;
  timestamp: string;
  authHeader: boolean;
  cookieCount: number;
}

export interface MethodStats {
  method: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  successCount: number;  // 2xx responses
  failureCount: number;  // 4xx, 5xx responses
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
      .map(([code, entryGroup]) => {
        const durations = entryGroup.map(e => e.time);
        const sizes = entryGroup.map(e => e.response.content.size);
        
        return {
          code,
          statusText: entryGroup[0].response.statusText,
          count: entryGroup.length,
          totalDuration: durations.reduce((sum, d) => sum + d, 0),
          avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
          minDuration: Math.min(...durations),
          maxDuration: Math.max(...durations),
          totalSize: sizes.reduce((sum, s) => sum + s, 0),
          avgSize: sizes.reduce((sum, s) => sum + s, 0) / sizes.length,
          urls: entryGroup.map(e => e.request.url)
        };
      })
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
      { min: 1048576, max: 10485760, label: '1MB-10MB' },
      { min: 10485760, max: Infinity, label: '10MB+' }
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

    return ranges
      .map(range => {
        const entryGroup = groups.get(range.label)!;
        const sizes = entryGroup.map(e => e.response.content.size);
        
        return {
          sizeRange: range.label,
          minBytes: range.min,
          maxBytes: range.max === Infinity ? -1 : range.max,
          count: entryGroup.length,
          totalSize: sizes.reduce((sum, s) => sum + s, 0),
          avgSize: entryGroup.length > 0 
            ? sizes.reduce((sum, s) => sum + s, 0) / sizes.length 
            : 0,
          urls: entryGroup.map(e => e.request.url)
        };
      })
      .filter(stat => stat.count > 0);
  }

  /**
   * Group entries by duration ranges
   */
  static groupByDuration(entries: HAREntry[]): DurationStats[] {
    const ranges = [
      { min: 0, max: 100, label: '0-100ms' },
      { min: 100, max: 500, label: '100-500ms' },
      { min: 500, max: 1000, label: '500ms-1s' },
      { min: 1000, max: 5000, label: '1s-5s' },
      { min: 5000, max: 10000, label: '5s-10s' },
      { min: 10000, max: Infinity, label: '10s+' }
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

    return ranges
      .map(range => {
        const entryGroup = groups.get(range.label)!;
        const durations = entryGroup.map(e => e.time);
        
        return {
          durationRange: range.label,
          minMs: range.min,
          maxMs: range.max === Infinity ? -1 : range.max,
          count: entryGroup.length,
          totalDuration: durations.reduce((sum, d) => sum + d, 0),
          avgDuration: entryGroup.length > 0 
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
            : 0,
          urls: entryGroup.map(e => e.request.url)
        };
      })
      .filter(stat => stat.count > 0);
  }

  /**
   * Find authorization/authentication failures (401, 403)
   */
  static findAuthFailures(entries: HAREntry[]): AuthFailure[] {
    return entries
      .filter(e => e.response.status === 401 || e.response.status === 403)
      .map(e => ({
        url: e.request.url,
        method: e.request.method,
        status: e.response.status,
        statusText: e.response.statusText,
        timestamp: e.startedDateTime,
        authHeader: e.request.headers.some(h => 
          h.name.toLowerCase() === 'authorization'
        ),
        cookieCount: e.request.cookies.length
      }));
  }

  /**
   * Group entries by HTTP method
   */
  static groupByMethod(entries: HAREntry[]): MethodStats[] {
    const groups = new Map<string, HAREntry[]>();
    
    for (const entry of entries) {
      const method = entry.request.method.toUpperCase();
      if (!groups.has(method)) {
        groups.set(method, []);
      }
      groups.get(method)!.push(entry);
    }

    return Array.from(groups.entries())
      .map(([method, entryGroup]) => {
        const durations = entryGroup.map(e => e.time);
        
        return {
          method,
          count: entryGroup.length,
          totalDuration: durations.reduce((sum, d) => sum + d, 0),
          avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
          successCount: entryGroup.filter(e => e.response.status >= 200 && e.response.status < 300).length,
          failureCount: entryGroup.filter(e => e.response.status >= 400).length
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate percentiles for request durations
   */
  static calculateDurationPercentiles(
    entries: HAREntry[],
    percentiles: number[] = [50, 75, 90, 95, 99]
  ): Record<string, number> {
    if (entries.length === 0) {
      return {};
    }

    const sortedDurations = entries
      .map(e => e.time)
      .sort((a, b) => a - b);

    const result: Record<string, number> = {};
    
    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sortedDurations.length) - 1;
      result[`p${p}`] = sortedDurations[Math.max(0, index)];
    }

    return result;
  }

  /**
   * Find slowest requests
   */
  static findSlowest(entries: HAREntry[], limit = 10): Array<{
    url: string;
    method: string;
    duration: number;
    status: number;
  }> {
    return entries
      .map(e => ({
        url: e.request.url,
        method: e.request.method,
        duration: e.time,
        status: e.response.status
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Find largest responses
   */
  static findLargest(entries: HAREntry[], limit = 10): Array<{
    url: string;
    method: string;
    size: number;
    contentType: string;
  }> {
    return entries
      .map(e => ({
        url: e.request.url,
        method: e.request.method,
        size: e.response.content.size,
        contentType: e.response.content.mimeType
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, limit);
  }

  /**
   * Calculate total bandwidth used
   */
  static calculateTotalBandwidth(entries: HAREntry[]): {
    totalBytes: number;
    totalMB: number;
    requestBytes: number;
    responseBytes: number;
  } {
    const totalBytes = entries.reduce((sum, e) => 
      sum + e.request.bodySize + e.response.content.size, 0
    );
    
    const requestBytes = entries.reduce((sum, e) => 
      sum + e.request.bodySize, 0
    );
    
    const responseBytes = entries.reduce((sum, e) => 
      sum + e.response.content.size, 0
    );

    return {
      totalBytes,
      totalMB: totalBytes / (1024 * 1024),
      requestBytes,
      responseBytes
    };
  }

  /**
   * Get time range of capture
   */
  static getTimeRange(entries: HAREntry[]): {
    start: string;
    end: string;
    durationMs: number;
  } | null {
    if (entries.length === 0) {
      return null;
    }

    const timestamps = entries.map(e => new Date(e.startedDateTime).getTime());
    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);

    return {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      durationMs: end - start
    };
  }
}
