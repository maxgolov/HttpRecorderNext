/**
 * Shared HAR file repair utility
 * Handles common HAR file corruption patterns and uses jsonrepair for comprehensive fixes
 */

import { jsonrepair } from 'jsonrepair';

export interface RepairResult {
    success: boolean;
    content: string;
    error?: string;
    repaired: boolean;
}

/**
 * Repairs malformed HAR file content using jsonrepair library
 * @param content - The potentially malformed HAR JSON content
 * @returns RepairResult with success status, repaired content, and metadata
 */
export function repairHARContent(content: string): RepairResult {
    try {
        // Strip BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }

        // Try to repair the JSON using jsonrepair
        const repairedContent = jsonrepair(content);
        
        // Verify the repaired content is valid JSON
        JSON.parse(repairedContent);
        
        return {
            success: true,
            content: repairedContent,
            repaired: repairedContent !== content
        };
    } catch (error) {
        return {
            success: false,
            content: content,
            error: error instanceof Error ? error.message : String(error),
            repaired: false
        };
    }
}

/**
 * Repairs and parses HAR file content in one step
 * @param content - The potentially malformed HAR JSON content
 * @returns Object with success status, parsed HAR object (if successful), error message, and repair status
 */
export function repairAndParseHAR(content: string): {
    success: boolean;
    har: any | null;
    error?: string;
    repaired: boolean;
} {
    const repairResult = repairHARContent(content);
    
    if (!repairResult.success) {
        return {
            success: false,
            har: null,
            error: repairResult.error,
            repaired: false
        };
    }

    try {
        const har = JSON.parse(repairResult.content);
        return {
            success: true,
            har,
            repaired: repairResult.repaired
        };
    } catch (error) {
        return {
            success: false,
            har: null,
            error: error instanceof Error ? error.message : String(error),
            repaired: repairResult.repaired
        };
    }
}
