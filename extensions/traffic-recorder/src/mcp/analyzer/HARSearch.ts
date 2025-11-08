/**
 * HAR Search - Flexible search and filtering of HAR entries
 * Framework-agnostic, pure filtering logic
 */

import { HARParser } from './HARParser';
import type { HAREntry } from './types';

export interface SearchCriteria {
  url?: string;                      // Substring match
  urlRegex?: string;                 // Regex pattern
  method?: string;                   // HTTP method (GET, POST, etc.)
  statusCode?: number;               // Exact status
  statusRange?: [number, number];    // e.g., [400, 499] for 4xx errors
  minDuration?: number;              // Minimum request duration (ms)
  maxDuration?: number;              // Maximum request duration (ms)
  minSize?: number;                  // Minimum payload size (bytes)
  maxSize?: number;                  // Maximum payload size (bytes)
  headers?: Record<string, string>;  // Request header name-value pairs (substring match on value)
  responseHeaders?: Record<string, string>; // Response header name-value pairs
  hasRequestBody?: boolean;          // Has POST data
  hasResponseBody?: boolean;         // Has response content
  contentType?: string;              // Response content type (substring match)
  afterDate?: string;                // ISO date string - entries after this time
  beforeDate?: string;               // ISO date string - entries before this time
  traceparent?: string;              // OpenTelemetry traceparent header TraceId substring match
}

export interface SearchResult {
  entry: HAREntry;
  index: number;                     // Original index in HAR entries array
  matchReasons: string[];            // Why this entry matched (for debugging/display)
}

export class HARSearch {
  /**
   * Search HAR entries with flexible criteria
   * All criteria are AND-ed together (entry must match all provided criteria)
   */
  static search(entries: HAREntry[], criteria: SearchCriteria): SearchResult[] {
    const results: SearchResult[] = [];

    for (const [index, entry] of entries.entries()) {
      const matchReasons: string[] = [];
      let matches = true;

      // URL substring match
      if (criteria.url !== undefined) {
        if (entry.request.url.toLowerCase().includes(criteria.url.toLowerCase())) {
          matchReasons.push(`URL contains "${criteria.url}"`);
        } else {
          matches = false;
        }
      }

      // URL regex match
      if (criteria.urlRegex !== undefined && matches) {
        try {
          const regex = new RegExp(criteria.urlRegex, 'i');
          if (regex.test(entry.request.url)) {
            matchReasons.push(`URL matches regex /${criteria.urlRegex}/`);
          } else {
            matches = false;
          }
        } catch (error) {
          // Invalid regex - skip this criterion
          matches = false;
        }
      }

      // HTTP method match
      if (criteria.method !== undefined && matches) {
        if (entry.request.method.toUpperCase() === criteria.method.toUpperCase()) {
          matchReasons.push(`Method is ${criteria.method}`);
        } else {
          matches = false;
        }
      }

      // Status code exact match
      if (criteria.statusCode !== undefined && matches) {
        if (entry.response.status === criteria.statusCode) {
          matchReasons.push(`Status code is ${criteria.statusCode}`);
        } else {
          matches = false;
        }
      }

      // Status range match
      if (criteria.statusRange !== undefined && matches) {
        const [min, max] = criteria.statusRange;
        if (entry.response.status >= min && entry.response.status <= max) {
          matchReasons.push(`Status in range ${min}-${max}`);
        } else {
          matches = false;
        }
      }

      // Duration match
      if (criteria.minDuration !== undefined && matches) {
        if (entry.time >= criteria.minDuration) {
          matchReasons.push(`Duration >= ${criteria.minDuration}ms`);
        } else {
          matches = false;
        }
      }
      
      if (criteria.maxDuration !== undefined && matches) {
        if (entry.time <= criteria.maxDuration) {
          matchReasons.push(`Duration <= ${criteria.maxDuration}ms`);
        } else {
          matches = false;
        }
      }

      // Size match
      if (criteria.minSize !== undefined && matches) {
        const size = entry.response.content.size;
        if (size >= criteria.minSize) {
          matchReasons.push(`Size >= ${criteria.minSize} bytes`);
        } else {
          matches = false;
        }
      }
      
      if (criteria.maxSize !== undefined && matches) {
        const size = entry.response.content.size;
        if (size <= criteria.maxSize) {
          matchReasons.push(`Size <= ${criteria.maxSize} bytes`);
        } else {
          matches = false;
        }
      }

      // Request header match
      if (criteria.headers !== undefined && matches) {
        for (const [headerName, headerValue] of Object.entries(criteria.headers)) {
          const actualValue = HARParser.getHeader(entry.request.headers, headerName);
          if (actualValue && actualValue.toLowerCase().includes(headerValue.toLowerCase())) {
            matchReasons.push(`Request header ${headerName} contains "${headerValue}"`);
          } else {
            matches = false;
            break;
          }
        }
      }

      // Response header match
      if (criteria.responseHeaders !== undefined && matches) {
        for (const [headerName, headerValue] of Object.entries(criteria.responseHeaders)) {
          const actualValue = HARParser.getHeader(entry.response.headers, headerName);
          if (actualValue && actualValue.toLowerCase().includes(headerValue.toLowerCase())) {
            matchReasons.push(`Response header ${headerName} contains "${headerValue}"`);
          } else {
            matches = false;
            break;
          }
        }
      }

      // Request body match
      if (criteria.hasRequestBody !== undefined && matches) {
        const hasBody = !!entry.request.postData;
        if (criteria.hasRequestBody === hasBody) {
          matchReasons.push(hasBody ? 'Has request body' : 'No request body');
        } else {
          matches = false;
        }
      }

      // Response body match
      if (criteria.hasResponseBody !== undefined && matches) {
        const hasBody = !!entry.response.content.text || entry.response.content.size > 0;
        if (criteria.hasResponseBody === hasBody) {
          matchReasons.push(hasBody ? 'Has response body' : 'No response body');
        } else {
          matches = false;
        }
      }

      // Content type match
      if (criteria.contentType !== undefined && matches) {
        const contentType = HARParser.getResponseContentType(entry);
        if (contentType && contentType.toLowerCase().includes(criteria.contentType.toLowerCase())) {
          matchReasons.push(`Content-Type contains "${criteria.contentType}"`);
        } else {
          matches = false;
        }
      }

      // Date range match
      if (criteria.afterDate !== undefined && matches) {
        const entryTime = new Date(entry.startedDateTime).getTime();
        const afterTime = new Date(criteria.afterDate).getTime();
        if (entryTime >= afterTime) {
          matchReasons.push(`After ${criteria.afterDate}`);
        } else {
          matches = false;
        }
      }
      
      if (criteria.beforeDate !== undefined && matches) {
        const entryTime = new Date(entry.startedDateTime).getTime();
        const beforeTime = new Date(criteria.beforeDate).getTime();
        if (entryTime <= beforeTime) {
          matchReasons.push(`Before ${criteria.beforeDate}`);
        } else {
          matches = false;
        }
      }

      // OpenTelemetry traceparent header match
      // Format: "00-{traceId}-{spanId}-{flags}"
      // Search for TraceId substring in the traceparent header
      if (criteria.traceparent !== undefined && matches) {
        const traceparentValue = HARParser.getHeader(entry.request.headers, 'traceparent');
        if (traceparentValue) {
          // traceparent format: version-traceId-spanId-flags
          // Extract traceId (second segment) or search entire value
          const parts = traceparentValue.split('-');
          const traceId = parts.length >= 2 ? parts[1] : '';
          
          if (traceId.toLowerCase().includes(criteria.traceparent.toLowerCase()) ||
              traceparentValue.toLowerCase().includes(criteria.traceparent.toLowerCase())) {
            matchReasons.push(`Traceparent contains TraceId "${criteria.traceparent}"`);
          } else {
            matches = false;
          }
        } else {
          // No traceparent header found
          matches = false;
        }
      }

      // Add to results if all criteria matched
      if (matches && matchReasons.length > 0) {
        results.push({ entry, index, matchReasons });
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

  /**
   * Find large responses
   */
  static findLarge(entries: HAREntry[], thresholdBytes = 1048576): SearchResult[] {
    return this.search(entries, { minSize: thresholdBytes });
  }

  /**
   * Find JSON responses
   */
  static findJSON(entries: HAREntry[]): SearchResult[] {
    return this.search(entries, { contentType: 'application/json' });
  }

  /**
   * Find by HTTP method
   */
  static byMethod(entries: HAREntry[], method: string): SearchResult[] {
    return this.search(entries, { method });
  }

  /**
   * Find successful requests (2xx status codes)
   */
  static findSuccessful(entries: HAREntry[]): SearchResult[] {
    return this.search(entries, { statusRange: [200, 299] });
  }

  /**
   * Find redirects (3xx status codes)
   */
  static findRedirects(entries: HAREntry[]): SearchResult[] {
    return this.search(entries, { statusRange: [300, 399] });
  }

  /**
   * Combine multiple search results (union)
   */
  static union(...resultSets: SearchResult[][]): SearchResult[] {
    const seen = new Set<number>();
    const combined: SearchResult[] = [];

    for (const resultSet of resultSets) {
      for (const result of resultSet) {
        if (!seen.has(result.index)) {
          seen.add(result.index);
          combined.push(result);
        }
      }
    }

    return combined.sort((a, b) => a.index - b.index);
  }

  /**
   * Intersect multiple search results (only entries in all sets)
   */
  static intersect(...resultSets: SearchResult[][]): SearchResult[] {
    if (resultSets.length === 0) {
      return [];
    }

    if (resultSets.length === 1) {
      return resultSets[0];
    }

    // Build index sets
    const indexSets = resultSets.map(rs => new Set(rs.map(r => r.index)));
    
    // Find intersection
    const intersection = new Set<number>();
    for (const index of indexSets[0]) {
      if (indexSets.every(set => set.has(index))) {
        intersection.add(index);
      }
    }

    // Return results from first set that are in intersection
    return resultSets[0].filter(r => intersection.has(r.index));
  }
}
