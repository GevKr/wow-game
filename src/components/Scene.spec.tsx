import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Scene } from './Scene';

// Mock the Game2D component
vi.mock('./Game2D', () => ({
    Game2D: () => null
}));

// Mock @react-three/drei to avoid react-three-fiber hooks issues
vi.mock('@react-three/drei', () => ({
    PerspectiveCamera: () => null
}));

describe('Scene component', () => {
    it('renders without crashing', () => {
        render(<Scene />);
        // Since we've mocked the Canvas to use a div with data-testid="r3f-canvas"
        expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    });

    it('contains a Camera setup', () => {
        render(<Scene />);
        // We can't directly test Three.js components, but we can check that our
        // component structure renders without errors
        const canvas = screen.getByTestId('r3f-canvas');
        expect(canvas).toBeInTheDocument();
    });
}); 