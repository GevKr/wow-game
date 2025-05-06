import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Vector3, Mesh, Euler, Group } from 'three';
import { act, renderHook } from '@testing-library/react';
import { useGameControls, type Surface, type GameState } from './useGameControls';

describe('useGameControls', () => {
    // Mock refs and state
    const mockPlayerRef = { current: { position: new Vector3(0, -5, 0) } as Mesh };
    const mockPlayerVelocity = { current: new Vector3(0, 0, 0) };
    const mockIsJumping = { current: false };
    const mockIsMoving = { current: false };
    const mockTargetX = { current: 0 };
    const mockTargetY = { current: 0 };
    const mockTargetCameraRotation = { current: new Euler(0, 0, 0) };
    const mockRotationProgress = { current: 0 };
    const mockTunnelRef = { current: null as Group | null };
    const mockTunnelPosition = { current: 0 };

    // Constants
    const TUNNEL_SIZE = 10;
    const BALL_RADIUS = 0.5;
    const LANE_COUNT = 5;
    const JUMP_FORCE = 5;
    const MOVE_SPEED = 5;
    const GRAVITY = 9.8;
    const TILE_SIZE = 1;

    // State variables
    let currentSurface: Surface = 'floor';
    let currentLane = 2; // Middle lane (0-indexed)
    let gameState: GameState = 'playing';
    let setIsFallingThroughGap = vi.fn();
    let setScore = vi.fn();

    // State setters
    const setCurrentSurface = vi.fn((surface: Surface) => {
        currentSurface = surface;
    });

    const setCurrentLane = vi.fn((lane: number) => {
        currentLane = lane;
    });

    const setGameState = vi.fn((state: GameState) => {
        gameState = state;
    });

    // Helper function
    const getLanePosition = (lane: number, totalLanes = LANE_COUNT) => {
        const laneWidth = TUNNEL_SIZE / totalLanes;
        return -TUNNEL_SIZE / 2 + laneWidth * (lane + 0.5);
    };

    // Mock keyboard events
    const createKeyboardEvent = (key: string) => {
        return new KeyboardEvent('keydown', { key });
    };

    beforeEach(() => {
        // Reset state before each test
        currentSurface = 'floor';
        currentLane = 2;
        gameState = 'playing';

        mockPlayerRef.current.position.set(0, -TUNNEL_SIZE / 2 + BALL_RADIUS, 0);
        mockPlayerVelocity.current.set(0, 0, 0);
        mockIsJumping.current = false;
        mockIsMoving.current = false;
        mockTargetX.current = 0;
        mockTargetY.current = 0;
        mockRotationProgress.current = 0;
        mockTargetCameraRotation.current = new Euler(0, 0, 0);
        mockTunnelPosition.current = 0;

        // Reset mocks
        vi.clearAllMocks();
        setIsFallingThroughGap = vi.fn();
        setScore = vi.fn();
    });

    it('initializes with correct values', () => {
        const { result } = renderHook(() => useGameControls({
            playerRef: mockPlayerRef,
            playerVelocity: mockPlayerVelocity,
            isJumping: mockIsJumping,
            isMoving: mockIsMoving,
            targetX: mockTargetX,
            targetY: mockTargetY,
            targetCameraRotation: mockTargetCameraRotation,
            rotationProgress: mockRotationProgress,
            tunnelRef: mockTunnelRef,
            tunnelPosition: mockTunnelPosition,
            currentSurface,
            setCurrentSurface,
            currentLane,
            setCurrentLane,
            gameState,
            setGameState,
            setIsFallingThroughGap,
            setScore,
            MOVE_SPEED,
            JUMP_FORCE,
            GRAVITY,
            TUNNEL_SIZE,
            TILE_SIZE,
            BALL_RADIUS,
            LANE_COUNT,
            getLanePosition
        }));

        expect(result.current).toHaveProperty('getGravityDirection');
        expect(result.current).toHaveProperty('snapToSurface');
        expect(result.current).toHaveProperty('transitionToSurface');
    });

    describe('Surface transitions', () => {
        it('transitions from floor to right wall when moving right at the edge', () => {
            // Setup: put player at the rightmost lane
            currentLane = LANE_COUNT - 1;

            renderHook(() => useGameControls({
                playerRef: mockPlayerRef,
                playerVelocity: mockPlayerVelocity,
                isJumping: mockIsJumping,
                isMoving: mockIsMoving,
                targetX: mockTargetX,
                targetY: mockTargetY,
                targetCameraRotation: mockTargetCameraRotation,
                rotationProgress: mockRotationProgress,
                tunnelRef: mockTunnelRef,
                tunnelPosition: mockTunnelPosition,
                currentSurface,
                setCurrentSurface,
                currentLane,
                setCurrentLane,
                gameState,
                setGameState,
                setIsFallingThroughGap,
                setScore,
                MOVE_SPEED,
                JUMP_FORCE,
                GRAVITY,
                TUNNEL_SIZE,
                TILE_SIZE,
                BALL_RADIUS,
                LANE_COUNT,
                getLanePosition
            }));

            // Simulate right arrow key press
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowRight'));
            });

            // Check if transition occurred
            expect(setCurrentSurface).toHaveBeenCalledWith('rightWall');
            expect(mockTargetCameraRotation.current).toEqual(new Euler(0, 0, Math.PI / 2));
            expect(mockRotationProgress.current).toBe(1.0);
            // Player should be at the top lane of the right wall
            expect(setCurrentLane).toHaveBeenCalledWith(0);
        });

        it('transitions from right wall to ceiling when moving up at the edge', () => {
            // Setup: put player on right wall at the top lane
            currentSurface = 'rightWall';
            currentLane = 0;

            renderHook(() => useGameControls({
                playerRef: mockPlayerRef,
                playerVelocity: mockPlayerVelocity,
                isJumping: mockIsJumping,
                isMoving: mockIsMoving,
                targetX: mockTargetX,
                targetY: mockTargetY,
                targetCameraRotation: mockTargetCameraRotation,
                rotationProgress: mockRotationProgress,
                tunnelRef: mockTunnelRef,
                tunnelPosition: mockTunnelPosition,
                currentSurface,
                setCurrentSurface,
                currentLane,
                setCurrentLane,
                gameState,
                setGameState,
                setIsFallingThroughGap,
                setScore,
                MOVE_SPEED,
                JUMP_FORCE,
                GRAVITY,
                TUNNEL_SIZE,
                TILE_SIZE,
                BALL_RADIUS,
                LANE_COUNT,
                getLanePosition
            }));

            // Simulate left arrow key press (which moves up on right wall)
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
            });

            // Check if transition occurred
            expect(setCurrentSurface).toHaveBeenCalledWith('ceiling');
            expect(mockTargetCameraRotation.current).toEqual(new Euler(0, 0, Math.PI));
            expect(mockRotationProgress.current).toBe(1.0);
            // Player should be at the rightmost lane of the ceiling
            expect(setCurrentLane).toHaveBeenCalledWith(LANE_COUNT - 1);
        });

        it('transitions from ceiling to left wall when moving left at the edge', () => {
            // Setup: put player on ceiling at the leftmost lane
            currentSurface = 'ceiling';
            currentLane = 0;

            renderHook(() => useGameControls({
                playerRef: mockPlayerRef,
                playerVelocity: mockPlayerVelocity,
                isJumping: mockIsJumping,
                isMoving: mockIsMoving,
                targetX: mockTargetX,
                targetY: mockTargetY,
                targetCameraRotation: mockTargetCameraRotation,
                rotationProgress: mockRotationProgress,
                tunnelRef: mockTunnelRef,
                tunnelPosition: mockTunnelPosition,
                currentSurface,
                setCurrentSurface,
                currentLane,
                setCurrentLane,
                gameState,
                setGameState,
                setIsFallingThroughGap,
                setScore,
                MOVE_SPEED,
                JUMP_FORCE,
                GRAVITY,
                TUNNEL_SIZE,
                TILE_SIZE,
                BALL_RADIUS,
                LANE_COUNT,
                getLanePosition
            }));

            // Simulate left arrow key press
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
            });

            // Check if transition occurred
            expect(setCurrentSurface).toHaveBeenCalledWith('leftWall');
            expect(mockTargetCameraRotation.current).toEqual(new Euler(0, 0, -Math.PI / 2));
            expect(mockRotationProgress.current).toBe(1.0);
            // Player should be at the top lane of the left wall
            expect(setCurrentLane).toHaveBeenCalledWith(0);
        });

        it('transitions from left wall to floor when moving down at the edge', () => {
            // Setup: put player on left wall at the bottom lane
            currentSurface = 'leftWall';
            currentLane = LANE_COUNT - 1;

            renderHook(() => useGameControls({
                playerRef: mockPlayerRef,
                playerVelocity: mockPlayerVelocity,
                isJumping: mockIsJumping,
                isMoving: mockIsMoving,
                targetX: mockTargetX,
                targetY: mockTargetY,
                targetCameraRotation: mockTargetCameraRotation,
                rotationProgress: mockRotationProgress,
                tunnelRef: mockTunnelRef,
                tunnelPosition: mockTunnelPosition,
                currentSurface,
                setCurrentSurface,
                currentLane,
                setCurrentLane,
                gameState,
                setGameState,
                setIsFallingThroughGap,
                setScore,
                MOVE_SPEED,
                JUMP_FORCE,
                GRAVITY,
                TUNNEL_SIZE,
                TILE_SIZE,
                BALL_RADIUS,
                LANE_COUNT,
                getLanePosition
            }));

            // Simulate left arrow key press (which moves down on left wall)
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
            });

            // Check if transition occurred
            expect(setCurrentSurface).toHaveBeenCalledWith('floor');
            expect(mockTargetCameraRotation.current).toEqual(new Euler(0, 0, 0));
            expect(mockRotationProgress.current).toBe(1.0);
            // Player should be at the leftmost lane of the floor
            expect(setCurrentLane).toHaveBeenCalledWith(0);
        });

        it('completes a full clockwise loop through all surfaces', () => {
            // Start on floor, middle lane
            currentSurface = 'floor';
            currentLane = 2;

            // Create the hook
            const { rerender } = renderHook(() => useGameControls({
                playerRef: mockPlayerRef,
                playerVelocity: mockPlayerVelocity,
                isJumping: mockIsJumping,
                isMoving: mockIsMoving,
                targetX: mockTargetX,
                targetY: mockTargetY,
                targetCameraRotation: mockTargetCameraRotation,
                rotationProgress: mockRotationProgress,
                tunnelRef: mockTunnelRef,
                tunnelPosition: mockTunnelPosition,
                currentSurface,
                setCurrentSurface,
                currentLane,
                setCurrentLane,
                gameState,
                setGameState,
                setIsFallingThroughGap,
                setScore,
                MOVE_SPEED,
                JUMP_FORCE,
                GRAVITY,
                TUNNEL_SIZE,
                TILE_SIZE,
                BALL_RADIUS,
                LANE_COUNT,
                getLanePosition
            }));

            // 1. Move to right wall
            for (let i = currentLane; i < LANE_COUNT - 1; i++) {
                act(() => {
                    window.dispatchEvent(createKeyboardEvent('ArrowRight'));
                });
            }

            // Final move to right wall
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowRight'));
            });

            expect(setCurrentSurface).toHaveBeenCalledWith('rightWall');

            // Rerender with updated state
            currentSurface = 'rightWall';
            currentLane = 0;
            rerender();

            // 2. Move to ceiling
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
            });

            expect(setCurrentSurface).toHaveBeenCalledWith('ceiling');

            // Rerender with updated state
            currentSurface = 'ceiling';
            currentLane = LANE_COUNT - 1;
            rerender();

            // 3. Move to left wall
            for (let i = currentLane; i > 0; i--) {
                act(() => {
                    window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
                });
            }

            // Final move to left wall
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
            });

            expect(setCurrentSurface).toHaveBeenCalledWith('leftWall');

            // Rerender with updated state
            currentSurface = 'leftWall';
            currentLane = 0;
            rerender();

            // 4. Move to floor
            for (let i = currentLane; i < LANE_COUNT - 1; i++) {
                act(() => {
                    window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
                });
            }

            // Final move to floor
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
            });

            expect(setCurrentSurface).toHaveBeenCalledWith('floor');

            // We've completed one full loop
            expect(setCurrentSurface).toHaveBeenCalledTimes(4);
        });
    });

    describe('Lane movement', () => {
        it('moves between lanes on the floor', () => {
            currentSurface = 'floor';
            currentLane = 2; // Start at middle lane

            renderHook(() => useGameControls({
                playerRef: mockPlayerRef,
                playerVelocity: mockPlayerVelocity,
                isJumping: mockIsJumping,
                isMoving: mockIsMoving,
                targetX: mockTargetX,
                targetY: mockTargetY,
                targetCameraRotation: mockTargetCameraRotation,
                rotationProgress: mockRotationProgress,
                tunnelRef: mockTunnelRef,
                tunnelPosition: mockTunnelPosition,
                currentSurface,
                setCurrentSurface,
                currentLane,
                setCurrentLane,
                gameState,
                setGameState,
                setIsFallingThroughGap,
                setScore,
                MOVE_SPEED,
                JUMP_FORCE,
                GRAVITY,
                TUNNEL_SIZE,
                TILE_SIZE,
                BALL_RADIUS,
                LANE_COUNT,
                getLanePosition
            }));

            // Move left one lane
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
            });

            expect(setCurrentLane).toHaveBeenCalledWith(1);
            expect(mockTargetX.current).toBe(getLanePosition(1));
            expect(mockIsMoving.current).toBe(true);

            // Reset for next test
            mockIsMoving.current = false;
            currentLane = 1;

            // Move right one lane (back to middle)
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowRight'));
            });

            expect(setCurrentLane).toHaveBeenCalledWith(2);
            expect(mockTargetX.current).toBe(getLanePosition(2));
            expect(mockIsMoving.current).toBe(true);
        });

        it('moves between lanes on walls (vertical movement)', () => {
            currentSurface = 'leftWall';
            currentLane = 2; // Start at middle lane

            renderHook(() => useGameControls({
                playerRef: mockPlayerRef,
                playerVelocity: mockPlayerVelocity,
                isJumping: mockIsJumping,
                isMoving: mockIsMoving,
                targetX: mockTargetX,
                targetY: mockTargetY,
                targetCameraRotation: mockTargetCameraRotation,
                rotationProgress: mockRotationProgress,
                tunnelRef: mockTunnelRef,
                tunnelPosition: mockTunnelPosition,
                currentSurface,
                setCurrentSurface,
                currentLane,
                setCurrentLane,
                gameState,
                setGameState,
                setIsFallingThroughGap,
                setScore,
                MOVE_SPEED,
                JUMP_FORCE,
                GRAVITY,
                TUNNEL_SIZE,
                TILE_SIZE,
                BALL_RADIUS,
                LANE_COUNT,
                getLanePosition
            }));

            // Move up one lane on left wall (right arrow)
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowRight'));
            });

            expect(setCurrentLane).toHaveBeenCalledWith(1);
            expect(mockTargetY.current).toBe(getLanePosition(1));
            expect(mockIsMoving.current).toBe(true);

            // Reset for next test
            mockIsMoving.current = false;
            currentLane = 1;

            // Move down one lane (back to middle)
            act(() => {
                window.dispatchEvent(createKeyboardEvent('ArrowLeft'));
            });

            expect(setCurrentLane).toHaveBeenCalledWith(2);
            expect(mockTargetY.current).toBe(getLanePosition(2));
            expect(mockIsMoving.current).toBe(true);
        });
    });

    it('starts the game when a key is pressed in start state', () => {
        gameState = 'start';

        renderHook(() => useGameControls({
            playerRef: mockPlayerRef,
            playerVelocity: mockPlayerVelocity,
            isJumping: mockIsJumping,
            isMoving: mockIsMoving,
            targetX: mockTargetX,
            targetY: mockTargetY,
            targetCameraRotation: mockTargetCameraRotation,
            rotationProgress: mockRotationProgress,
            tunnelRef: mockTunnelRef,
            tunnelPosition: mockTunnelPosition,
            currentSurface,
            setCurrentSurface,
            currentLane,
            setCurrentLane,
            gameState,
            setGameState,
            setIsFallingThroughGap,
            setScore,
            MOVE_SPEED,
            JUMP_FORCE,
            GRAVITY,
            TUNNEL_SIZE,
            TILE_SIZE,
            BALL_RADIUS,
            LANE_COUNT,
            getLanePosition
        }));

        // Press any key
        act(() => {
            window.dispatchEvent(createKeyboardEvent('ArrowRight'));
        });

        expect(setGameState).toHaveBeenCalledWith('playing');
    });

    it('restarts the game when "r" is pressed in game over state', () => {
        gameState = 'gameOver';

        renderHook(() => useGameControls({
            playerRef: mockPlayerRef,
            playerVelocity: mockPlayerVelocity,
            isJumping: mockIsJumping,
            isMoving: mockIsMoving,
            targetX: mockTargetX,
            targetY: mockTargetY,
            targetCameraRotation: mockTargetCameraRotation,
            rotationProgress: mockRotationProgress,
            tunnelRef: mockTunnelRef,
            tunnelPosition: mockTunnelPosition,
            currentSurface,
            setCurrentSurface,
            currentLane,
            setCurrentLane,
            gameState,
            setGameState,
            setIsFallingThroughGap,
            setScore,
            MOVE_SPEED,
            JUMP_FORCE,
            GRAVITY,
            TUNNEL_SIZE,
            TILE_SIZE,
            BALL_RADIUS,
            LANE_COUNT,
            getLanePosition
        }));

        // Simulate key up event for 'r'
        act(() => {
            window.dispatchEvent(new KeyboardEvent('keyup', { key: 'r' }));
        });

        expect(setGameState).toHaveBeenCalledWith('playing');
        expect(setScore).toHaveBeenCalledWith(0);
        expect(setCurrentLane).toHaveBeenCalledWith(2);
        expect(setCurrentSurface).toHaveBeenCalledWith('floor');
        expect(setIsFallingThroughGap).toHaveBeenCalledWith(false);
        expect(mockTunnelPosition.current).toBe(0);
    });

    it('handles jumping when space is pressed', () => {
        renderHook(() => useGameControls({
            playerRef: mockPlayerRef,
            playerVelocity: mockPlayerVelocity,
            isJumping: mockIsJumping,
            isMoving: mockIsMoving,
            targetX: mockTargetX,
            targetY: mockTargetY,
            targetCameraRotation: mockTargetCameraRotation,
            rotationProgress: mockRotationProgress,
            tunnelRef: mockTunnelRef,
            tunnelPosition: mockTunnelPosition,
            currentSurface,
            setCurrentSurface,
            currentLane,
            setCurrentLane,
            gameState,
            setGameState,
            setIsFallingThroughGap,
            setScore,
            MOVE_SPEED,
            JUMP_FORCE,
            GRAVITY,
            TUNNEL_SIZE,
            TILE_SIZE,
            BALL_RADIUS,
            LANE_COUNT,
            getLanePosition
        }));

        // Press space to jump
        act(() => {
            window.dispatchEvent(createKeyboardEvent(' '));
        });

        expect(mockIsJumping.current).toBe(true);
        expect(mockPlayerVelocity.current.y).toBe(JUMP_FORCE); // On floor, jump is upward (+Y)
    });
}); 