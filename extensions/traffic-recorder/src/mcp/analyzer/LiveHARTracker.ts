/**
 * Live HAR Tracker - In-memory buffer for active captures
 * Tracks HAR entries in real-time during recording sessions
 */

import type { HAR, HAREntry } from './types';

export interface LiveTrackerStats {
  entryCount: number;
  totalSize: number;
  oldestEntry: string | null;
  newestEntry: string | null;
  isAtCapacity: boolean;
}

export class LiveHARTracker {
  private entries: HAREntry[] = [];
  private readonly maxEntries: number;
  private sessionId: string | null = null;
  private startTime: Date | null = null;

  constructor(maxEntries = 10000) {
    if (maxEntries < 1) {
      throw new Error('maxEntries must be at least 1');
    }
    this.maxEntries = maxEntries;
  }

  /**
   * Start a new tracking session
   */
  startSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.startTime = new Date();
    this.entries = [];
  }

  /**
   * Stop current session
   */
  stopSession(): void {
    this.sessionId = null;
    this.startTime = null;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.sessionId !== null;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Add entry to live buffer
   * @returns true if added, false if rejected (session not active)
   */
  add(entry: HAREntry): boolean {
    if (!this.isSessionActive()) {
      return false;
    }

    this.entries.push(entry);
    
    // Trim if exceeding max (FIFO)
    if (this.entries.length > this.maxEntries) {
      this.entries.shift(); // Remove oldest
    }

    return true;
  }

  /**
   * Add multiple entries at once
   */
  addBatch(entries: HAREntry[]): number {
    if (!this.isSessionActive()) {
      return 0;
    }

    let added = 0;
    for (const entry of entries) {
      if (this.add(entry)) {
        added++;
      }
    }
    return added;
  }

  /**
   * Get all current entries (returns copy to prevent external mutation)
   */
  getAll(): HAREntry[] {
    return [...this.entries];
  }

  /**
   * Get entries after a specific index (for incremental updates)
   */
  getAfterIndex(index: number): HAREntry[] {
    if (index < 0 || index >= this.entries.length) {
      return [];
    }
    return this.entries.slice(index + 1);
  }

  /**
   * Get last N entries
   */
  getLast(count: number): HAREntry[] {
    if (count <= 0) {
      return [];
    }
    return this.entries.slice(-count);
  }

  /**
   * Get most recent N entries (alias for getLast)
   */
  getLatest(count: number): HAREntry[] {
    return this.getLast(count);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalRequests: number;
    totalDuration: number;
    avgDuration: number;
    statusCodes: Map<number, number>;
  } {
    const totalDuration = this.entries.reduce((sum, e) => sum + e.time, 0);
    const statusCodes = new Map<number, number>();
    
    for (const entry of this.entries) {
      const status = entry.response.status;
      statusCodes.set(status, (statusCodes.get(status) || 0) + 1);
    }

    return {
      totalRequests: this.entries.length,
      totalDuration,
      avgDuration: this.entries.length > 0 ? totalDuration / this.entries.length : 0,
      statusCodes
    };
  }

  /**
   * Clear buffer without stopping session
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Reset tracker (clear buffer and stop session)
   */
  reset(): void {
    this.entries = [];
    this.sessionId = null;
    this.startTime = null;
  }

  /**
   * Export as HAR format
   */
  toHAR(): HAR {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'Traffic Cop',
          version: '0.7.0'
        },
        browser: {
          name: 'Live Capture',
          version: this.sessionId || 'unknown'
        },
        entries: this.entries,
        comment: this.sessionId 
          ? `Live capture session: ${this.sessionId}` 
          : undefined
      }
    };
  }

  /**
   * Export as JSON string
   */
  toJSON(pretty = false): string {
    const har = this.toHAR();
    return pretty ? JSON.stringify(har, null, 2) : JSON.stringify(har);
  }

  /**
   * Get current statistics
   */
  getStats(): LiveTrackerStats {
    const totalSize = this.entries.reduce((sum, e) => 
      sum + e.response.content.size, 0
    );

    return {
      entryCount: this.entries.length,
      totalSize,
      oldestEntry: this.entries.length > 0 
        ? this.entries[0].startedDateTime 
        : null,
      newestEntry: this.entries.length > 0 
        ? this.entries[this.entries.length - 1].startedDateTime 
        : null,
      isAtCapacity: this.entries.length >= this.maxEntries
    };
  }

  /**
   * Get entry count
   */
  get count(): number {
    return this.entries.length;
  }

  /**
   * Get max capacity
   */
  get capacity(): number {
    return this.maxEntries;
  }

  /**
   * Get remaining capacity
   */
  get remainingCapacity(): number {
    return this.maxEntries - this.entries.length;
  }

  /**
   * Check if at capacity
   */
  isAtCapacity(): boolean {
    return this.entries.length >= this.maxEntries;
  }

  /**
   * Get session start time
   */
  getStartTime(): Date | null {
    return this.startTime;
  }

  /**
   * Get session duration in milliseconds
   */
  getSessionDuration(): number | null {
    if (!this.startTime) {
      return null;
    }
    return Date.now() - this.startTime.getTime();
  }
}
