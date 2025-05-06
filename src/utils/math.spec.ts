import { describe, it, expect, vi } from 'vitest';
import { lerp, clamp, randomInRange, degToRad, radToDeg } from './math';

describe('Math utilities', () => {
    describe('lerp', () => {
        it('should correctly interpolate between two values', () => {
            expect(lerp(0, 10, 0)).toBe(0);
            expect(lerp(0, 10, 1)).toBe(10);
            expect(lerp(0, 10, 0.5)).toBe(5);
            expect(lerp(10, 20, 0.5)).toBe(15);
        });

        it('should handle negative values', () => {
            expect(lerp(-10, 10, 0.5)).toBe(0);
            expect(lerp(-20, -10, 0.5)).toBe(-15);
        });

        it('should work with t values outside 0-1 range', () => {
            expect(lerp(0, 10, 2)).toBe(20);
            expect(lerp(0, 10, -1)).toBe(-10);
        });
    });

    describe('clamp', () => {
        it('should return the value if it is within range', () => {
            expect(clamp(5, 0, 10)).toBe(5);
        });

        it('should return the min value if value is less than min', () => {
            expect(clamp(-5, 0, 10)).toBe(0);
        });

        it('should return the max value if value is greater than max', () => {
            expect(clamp(15, 0, 10)).toBe(10);
        });

        it('should handle all negative values', () => {
            expect(clamp(-15, -20, -10)).toBe(-15);
            expect(clamp(-25, -20, -10)).toBe(-20);
            expect(clamp(-5, -20, -10)).toBe(-10);
        });
    });

    describe('randomInRange', () => {
        it('should return a value within the specified range', () => {
            // Mock Math.random to return a fixed value for testing
            vi.spyOn(Math, 'random').mockReturnValue(0.5);

            expect(randomInRange(0, 10)).toBe(5);
            expect(randomInRange(10, 20)).toBe(15);
            expect(randomInRange(-10, 10)).toBe(0);

            vi.restoreAllMocks();
        });
    });

    describe('degToRad', () => {
        it('should correctly convert degrees to radians', () => {
            expect(degToRad(0)).toBe(0);
            expect(degToRad(180)).toBeCloseTo(Math.PI);
            expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
            expect(degToRad(360)).toBeCloseTo(2 * Math.PI);
        });
    });

    describe('radToDeg', () => {
        it('should correctly convert radians to degrees', () => {
            expect(radToDeg(0)).toBe(0);
            expect(radToDeg(Math.PI)).toBeCloseTo(180);
            expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
            expect(radToDeg(2 * Math.PI)).toBeCloseTo(360);
        });
    });
}); 