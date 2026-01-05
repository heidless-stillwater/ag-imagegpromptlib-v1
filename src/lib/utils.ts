/**
 * Utility functions
 */

/**
 * Generates a deterministic ID from a string seed using SHA-256.
 * Returns a hexadecimal string.
 * This is useful for creating unique but consistent document IDs.
 * Note: This uses the Web Crypto API which is available in modern browsers and Node.js.
 */
export async function generateDeterministicId(seed: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(seed);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
