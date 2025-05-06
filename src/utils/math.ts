/**
 * Linear interpolation between two values
 * @param start The start value
 * @param end The end value
 * @param t The interpolation factor (0-1)
 * @returns The interpolated value
 */
export function lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
}

/**
 * Clamps a value between min and max
 * @param value The value to clamp
 * @param min The minimum value
 * @param max The maximum value
 * @returns The clamped value
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Generates a random number between min and max
 * @param min The minimum value
 * @param max The maximum value
 * @returns A random number in the range
 */
export function randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

/**
 * Converts degrees to radians
 * @param degrees The angle in degrees
 * @returns The angle in radians
 */
export function degToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees
 * @param radians The angle in radians
 * @returns The angle in degrees
 */
export function radToDeg(radians: number): number {
    return radians * (180 / Math.PI);
} 