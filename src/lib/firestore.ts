/**
 * Firestore Utilities
 */

/**
 * Robustly sanitizes data for Firestore.
 * 1. Uses JSON serialization to strip non-plain properties and undefined values from objects.
 * 2. Recursively detects and flattens nested arrays which are illegal in Firestore.
 */
export function sanitizeData(data: any): any {
    if (data === undefined) return null;

    // Step 1: Force to plain JSON structure
    // This removes functions, undefined from objects, and non-plain types.
    let jsonClean: any;
    try {
        jsonClean = JSON.parse(JSON.stringify(data, (key, value) => {
            // Convert undefined to null in arrays (JSON.stringify does this by default,
            // but we make it explicit for clarity)
            if (value === undefined) return null;
            return value;
        }));
    } catch (e) {
        console.error('JSON serialization failed during sanitization:', e);
        return data;
    }

    // Step 2: Recursively handle Firestore-specific constraints
    const finalize = (val: any, isCurrentlyInArray: boolean): any => {
        if (val === null || typeof val !== 'object') return val;

        if (Array.isArray(val)) {
            if (isCurrentlyInArray) {
                // Nested array detected (Array inside an Array)
                // Firestore doesn't allow this, so we flatten it to a string.
                return JSON.stringify(val);
            }
            // First level array: process items and set isCurrentlyInArray to true
            return val.map(item => finalize(item, true));
        }

        // It's a plain object
        const result: any = {};
        for (const [k, v] of Object.entries(val)) {
            // Important: Reset isCurrentlyInArray to false for object fields!
            // Firestore ALLOWS arrays inside maps that are inside arrays.
            // Only direct [ [ ... ] ] nesting is prohibited.
            result[k] = finalize(v, false);
        }
        return result;
    };

    return finalize(jsonClean, false);
}
