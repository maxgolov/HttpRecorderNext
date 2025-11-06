/**
 * HAR Parser - Framework-agnostic HAR file parsing and manipulation
 * NO dependencies on VS Code or Node.js specific APIs
 */

import type { HAR, HAREntry, HARHeader } from './types';

export class HARParser {
  /**
   * Parse HAR file from JSON string
   * @throws Error if JSON is invalid or HAR structure is malformed
   */
  static parse(json: string): HAR {
    let data: any;
    
    try {
      data = JSON.parse(json);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Validate basic HAR structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid HAR format: root must be an object');
    }
    
    if (!data.log || typeof data.log !== 'object') {
      throw new Error('Invalid HAR format: missing log object');
    }
    
    if (!data.log.entries || !Array.isArray(data.log.entries)) {
      throw new Error('Invalid HAR format: log.entries must be an array');
    }
    
    return data as HAR;
  }

  /**
   * Validate HAR structure thoroughly
   * @throws Error if HAR is invalid with detailed message
   */
  static validate(har: HAR): void {
    if (!har.log.version) {
      throw new Error('Invalid HAR: missing log.version');
    }
    
    if (!har.log.creator || !har.log.creator.name || !har.log.creator.version) {
      throw new Error('Invalid HAR: missing or incomplete log.creator');
    }
    
    for (const [index, entry] of har.log.entries.entries()) {
      if (!entry.request || typeof entry.request !== 'object') {
        throw new Error(`Invalid HAR entry at index ${index}: missing request object`);
      }
      
      if (!entry.response || typeof entry.response !== 'object') {
        throw new Error(`Invalid HAR entry at index ${index}: missing response object`);
      }
      
      if (!entry.request.method) {
        throw new Error(`Invalid HAR entry at index ${index}: missing request.method`);
      }
      
      if (!entry.request.url) {
        throw new Error(`Invalid HAR entry at index ${index}: missing request.url`);
      }
      
      if (typeof entry.response.status !== 'number') {
        throw new Error(`Invalid HAR entry at index ${index}: response.status must be a number`);
      }
      
      if (!entry.startedDateTime) {
        throw new Error(`Invalid HAR entry at index ${index}: missing startedDateTime`);
      }
      
      if (typeof entry.time !== 'number') {
        throw new Error(`Invalid HAR entry at index ${index}: time must be a number`);
      }
    }
  }

  /**
   * Extract URL object from entry
   * @throws Error if URL is malformed
   */
  static getURL(entry: HAREntry): URL {
    try {
      return new URL(entry.request.url);
    } catch (error) {
      throw new Error(`Invalid URL in HAR entry: ${entry.request.url}`);
    }
  }

  /**
   * Get header value (case-insensitive search)
   * @returns Header value or undefined if not found
   */
  static getHeader(headers: HARHeader[], name: string): string | undefined {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value;
  }

  /**
   * Get all header values for a name (case-insensitive, handles duplicate headers)
   * @returns Array of header values (empty if none found)
   */
  static getHeaders(headers: HARHeader[], name: string): string[] {
    return headers
      .filter(h => h.name.toLowerCase() === name.toLowerCase())
      .map(h => h.value);
  }

  /**
   * Check if entry has a specific header (case-insensitive)
   */
  static hasHeader(headers: HARHeader[], name: string): boolean {
    return headers.some(h => h.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Get request content type
   */
  static getRequestContentType(entry: HAREntry): string | undefined {
    return this.getHeader(entry.request.headers, 'content-type');
  }

  /**
   * Get response content type
   */
  static getResponseContentType(entry: HAREntry): string | undefined {
    return entry.response.content.mimeType || this.getHeader(entry.response.headers, 'content-type');
  }

  /**
   * Check if response is JSON
   */
  static isJSONResponse(entry: HAREntry): boolean {
    const contentType = this.getResponseContentType(entry);
    return contentType ? contentType.includes('application/json') : false;
  }

  /**
   * Get query parameter value
   */
  static getQueryParam(entry: HAREntry, name: string): string | undefined {
    const param = entry.request.queryString.find(q => q.name === name);
    return param?.value;
  }

  /**
   * Get all query parameters as object
   */
  static getQueryParams(entry: HAREntry): Record<string, string> {
    const params: Record<string, string> = {};
    for (const param of entry.request.queryString) {
      params[param.name] = param.value;
    }
    return params;
  }

  /**
   * Get cookie value
   */
  static getCookie(entry: HAREntry, name: string): string | undefined {
    const cookie = entry.request.cookies.find(c => c.name === name);
    return cookie?.value;
  }

  /**
   * Format entry as readable string for logging
   */
  static formatEntry(entry: HAREntry): string {
    const url = entry.request.url;
    const method = entry.request.method;
    const status = entry.response.status;
    const time = Math.round(entry.time);
    const size = entry.response.content.size;
    
    return `${method} ${url} - ${status} (${time}ms, ${size} bytes)`;
  }

  /**
   * Create minimal HAR structure (useful for testing)
   */
  static createMinimalHAR(entries: HAREntry[] = []): HAR {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'Traffic Cop',
          version: '0.7.0'
        },
        entries
      }
    };
  }

  /**
   * Serialize HAR to JSON string with optional pretty printing
   */
  static stringify(har: HAR, pretty = false): string {
    return pretty ? JSON.stringify(har, null, 2) : JSON.stringify(har);
  }
}
