/**
 * Shared HAR file repair utilities
 * Handles common corruption patterns in HAR files using jsonrepair library
 */

export interface RepairResult {
    success: boolean;
    content: string;
    error?: string;
    repaired: boolean;
}

// Lazy-loaded jsonrepair module
let jsonrepairModule: any = null;

async function getJsonRepair(): Promise<any> {
    if (!jsonrepairModule) {
        jsonrepairModule = await import('jsonrepair');
    }
    return jsonrepairModule.jsonrepair;
}

/**
 * Repair corrupted HAR file content
 * Uses the jsonrepair library which handles:
 * - Missing closing braces/brackets
 * - Extra commas (}, , , {)
 * - Truncated JSON
 * - Missing quotes
 * - And many other JSON malformations
 */
export async function repairHARContent(content: string): Promise<RepairResult> {
    try {
        // First, check if it's already valid JSON
        JSON.parse(content);
        return {
            success: true,
            content,
            repaired: false
        };
    } catch (parseError: any) {
        // Content is malformed, attempt repair
        try {
            // Strip BOM (Byte Order Mark) if present
            let cleanContent = content;
            if (cleanContent.charCodeAt(0) === 0xFEFF) {
                cleanContent = cleanContent.slice(1);
            }

            // Use jsonrepair to fix the content
            const jsonrepair = await getJsonRepair();
            const repaired = jsonrepair(cleanContent);
            
            // Verify the repair worked
            JSON.parse(repaired);
            
            return {
                success: true,
                content: repaired,
                repaired: true,
                error: `Auto-repaired: ${parseError.message}`
            };
        } catch (repairError: any) {
            // Repair failed
            return {
                success: false,
                content,
                repaired: false,
                error: `Failed to repair: ${repairError.message}. Original error: ${parseError.message}`
            };
        }
    }
}

/**
 * Repair and parse HAR content in one step
 */
export async function repairAndParseHAR(content: string): Promise<{ success: boolean; har?: any; error?: string; repaired: boolean }> {
    const result = await repairHARContent(content);
    
    if (result.success) {
        try {
            const har = JSON.parse(result.content);
            return {
                success: true,
                har,
                repaired: result.repaired,
                error: result.error
            };
        } catch (error: any) {
            return {
                success: false,
                repaired: result.repaired,
                error: `Parsing failed after repair: ${error.message}`
            };
        }
    }
    
    return {
        success: false,
        repaired: false,
        error: result.error
    };
}
