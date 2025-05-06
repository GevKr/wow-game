import '@testing-library/jest-dom';
import React from 'react';
import { vi, type MockInstance } from 'vitest';
import type { ReactNode } from 'react';

// Mock for ResizeObserver which isn't available in happy-dom
class MockResizeObserver {
    observe(): void { }
    unobserve(): void { }
    disconnect(): void { }
}

// Mock for three.js WebGLRenderer as it's not available in jsdom/happy-dom
class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    setSize(): void { }
    render(): void { }
    dispose(): void { }
    setClearColor(): void { }
    setPixelRatio(): void { }
}

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback): number => setTimeout(callback, 0);
global.cancelAnimationFrame = (id: number): void => clearTimeout(id);

// Add missing browser APIs to test environment
global.ResizeObserver = MockResizeObserver as any;

// Mock THREE
vi.mock('three', async () => {
    const actual = await import('three');
    return {
        ...actual,
        WebGLRenderer: MockWebGLRenderer,
    };
});

// Mock React Three Fiber to prevent WebGL context issues in tests
vi.mock('@react-three/fiber', async () => {
    const actual = await import('@react-three/fiber');
    return {
        ...actual,
        Canvas: ({ children, ...props }: { children: ReactNode;[key: string]: any }) =>
            React.createElement('div', { 'data-testid': 'r3f-canvas', ...props }, children)
    };
});

// Define types for Vec3
interface MockVec3Props {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): MockVec3Props;
}

// Mock cannon-es since it's not compatible with jsdom/happy-dom
vi.mock('cannon-es', () => {
    const mockFn = (): MockInstance => vi.fn();

    class MockVec3 implements MockVec3Props {
        x: number;
        y: number;
        z: number;

        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }

        set(x: number, y: number, z: number): MockVec3Props {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        }
    }

    return {
        default: {
            World: class MockWorld {
                gravity = { set: vi.fn() };
                bodies: any[] = [];
                addBody = vi.fn();
                removeBody = vi.fn();
                step = vi.fn();
            },
            Body: class MockBody {
                position = { set: vi.fn(), copy: vi.fn() };
                quaternion = { set: vi.fn(), copy: vi.fn() };
                addEventListener = vi.fn();
                removeEventListener = vi.fn();
            },
            Material: class MockMaterial { },
            ContactMaterial: class MockContactMaterial { },
            Vec3: MockVec3,
            Quaternion: class MockQuaternion {
                set(): any {
                    return this;
                }
            },
            Box: class MockBox { },
            Sphere: class MockSphere { },
            Plane: class MockPlane { },
        },
    };
}); 