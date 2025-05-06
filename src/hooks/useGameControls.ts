import { useEffect, MutableRefObject } from 'react';
import { Vector3, Mesh, Euler, Group } from 'three';

// Surface types the player can run on
export type Surface = 'floor' | 'ceiling' | 'leftWall' | 'rightWall';

// Game states
export type GameState = 'start' | 'playing' | 'gameOver';

// Each surface has LANES_PER_SURFACE lanes
// Total lanes = 4 surfaces * LANES_PER_SURFACE
const LANES_PER_SURFACE = 5;
const TOTAL_LANES = 4 * LANES_PER_SURFACE; // 20 lanes (0-19)

type UseGameControlsProps = {
    // Player state
    playerRef: MutableRefObject<Mesh | null>;
    playerVelocity: MutableRefObject<Vector3>;
    isJumping: MutableRefObject<boolean>;
    isMoving: MutableRefObject<boolean>;
    targetX: MutableRefObject<number>;
    targetY: MutableRefObject<number>;

    // Camera state
    targetCameraRotation: MutableRefObject<Euler>;
    rotationProgress: MutableRefObject<number>;

    // World state
    tunnelRef?: MutableRefObject<Group | null>;
    tunnelPosition: MutableRefObject<number>;

    // Game state
    currentSurface: Surface;
    setCurrentSurface: (surface: Surface) => void;
    currentLane: number;
    setCurrentLane: (lane: number) => void;
    gameState: GameState;
    setGameState: (state: GameState) => void;
    setIsFallingThroughGap: (falling: boolean) => void;
    setScore: (score: number) => void;

    // Constants
    MOVE_SPEED?: number;
    JUMP_FORCE: number;
    GRAVITY?: number;
    TUNNEL_SIZE: number;
    TILE_SIZE?: number;
    BALL_RADIUS: number;
    LANE_COUNT: number;

    // Helper functions
    getLanePosition: (lane: number, totalLanes?: number) => number;
};

export function useGameControls({
    // Player state
    playerRef,
    playerVelocity,
    isJumping,
    isMoving,
    targetX,
    targetY,

    // Camera state
    targetCameraRotation,
    rotationProgress,

    // World state
    tunnelRef,
    tunnelPosition,

    // Game state
    currentSurface,
    setCurrentSurface,
    currentLane,
    setCurrentLane,
    gameState,
    setGameState,
    setIsFallingThroughGap,
    setScore,

    // Constants
    MOVE_SPEED,
    JUMP_FORCE,
    GRAVITY,
    TUNNEL_SIZE,
    TILE_SIZE,
    BALL_RADIUS,
    LANE_COUNT,

    // Helper functions
    getLanePosition,
}: UseGameControlsProps) {

    /**
     * Helper function to get the surface and local lane from a global lane number
     * Floor:     0-4 (lanes 0-4 from left to right)
     * RightWall: 5-9 (lanes 0-4 from top to bottom)
     * Ceiling:   10-14 (lanes 4-0 from left to right - REVERSED)
     * LeftWall:  15-19 (lanes 4-0 from top to bottom - REVERSED)
     */
    const getSurfaceAndLocalLane = (globalLane: number) => {
        // Ensure lane is within 0-19 range
        const normalizedLane = ((globalLane % TOTAL_LANES) + TOTAL_LANES) % TOTAL_LANES;

        // Determine surface based on lane range
        let surface: Surface;
        let localLane: number;

        if (normalizedLane < LANES_PER_SURFACE) {
            // Floor: 0-4 → local 0-4
            surface = 'floor';
            localLane = normalizedLane % LANES_PER_SURFACE;
        } else if (normalizedLane < 2 * LANES_PER_SURFACE) {
            // Right Wall: 5-9 → local 0-4
            surface = 'rightWall';
            localLane = normalizedLane % LANES_PER_SURFACE;
        } else if (normalizedLane < 3 * LANES_PER_SURFACE) {
            // Ceiling: 10-14 → local 4-0 (REVERSED)
            surface = 'ceiling';
            localLane = LANES_PER_SURFACE - 1 - (normalizedLane % LANES_PER_SURFACE);
        } else {
            // Left Wall: 15-19 → local 4-0 (REVERSED)
            surface = 'leftWall';
            localLane = LANES_PER_SURFACE - 1 - (normalizedLane % LANES_PER_SURFACE);
        }

        return { surface, localLane };
    };

    /**
     * Helper function to get the global lane (0-19) from a surface and local lane
     */
    const getGlobalLane = (surface: Surface, localLane: number) => {
        let globalLane: number;

        switch (surface) {
            case 'floor':
                // Floor: local 0-4 → global 0-4
                globalLane = localLane;
                break;
            case 'rightWall':
                // Right Wall: local 0-4 → global 5-9
                globalLane = LANES_PER_SURFACE + localLane;
                break;
            case 'ceiling':
                // Ceiling: local 4-0 → global 10-14 (REVERSED)
                globalLane = 2 * LANES_PER_SURFACE + (LANES_PER_SURFACE - 1 - localLane);
                break;
            case 'leftWall':
                // Left Wall: local 4-0 → global 15-19 (REVERSED)
                globalLane = 3 * LANES_PER_SURFACE + (LANES_PER_SURFACE - 1 - localLane);
                break;
            default:
                globalLane = 0;
        }

        return globalLane;
    };

    // Get gravity direction based on current surface
    const getGravityDirection = () => {
        switch (currentSurface) {
            case 'floor':
                return new Vector3(0, -1, 0); // Down is -Y
            case 'ceiling':
                return new Vector3(0, 1, 0);  // Down is +Y
            case 'leftWall':
                return new Vector3(-1, 0, 0); // Down is -X
            case 'rightWall':
                return new Vector3(1, 0, 0);  // Down is +X
            default:
                return new Vector3(0, -1, 0);
        }
    };

    // Helper to ensure the player is properly attached to the current surface
    const snapToSurface = () => {
        if (!playerRef.current) return;

        console.log("Snapping to surface:", currentSurface);

        switch (currentSurface) {
            case 'floor':
                playerRef.current.position.y = -TUNNEL_SIZE / 2 + BALL_RADIUS;
                playerVelocity.current.y = 0;
                break;
            case 'ceiling':
                playerRef.current.position.y = TUNNEL_SIZE / 2 - BALL_RADIUS;
                playerVelocity.current.y = 0;
                break;
            case 'leftWall':
                playerRef.current.position.x = -TUNNEL_SIZE / 2 + BALL_RADIUS;
                playerVelocity.current.x = 0;
                break;
            case 'rightWall':
                playerRef.current.position.x = TUNNEL_SIZE / 2 - BALL_RADIUS;
                playerVelocity.current.x = 0;
                break;
        }

        isJumping.current = false;
    };

    // Set player position based on surface and lane
    const positionPlayerAtLane = (surface: Surface, localLane: number) => {
        if (!playerRef.current) return;

        const position = getLanePosition(localLane, LANES_PER_SURFACE);

        switch (surface) {
            case 'floor':
                playerRef.current.position.set(
                    position,
                    -TUNNEL_SIZE / 2 + BALL_RADIUS,
                    playerRef.current.position.z
                );
                targetX.current = position;
                break;
            case 'ceiling':
                playerRef.current.position.set(
                    position,
                    TUNNEL_SIZE / 2 - BALL_RADIUS,
                    playerRef.current.position.z
                );
                targetX.current = position;
                break;
            case 'leftWall':
                playerRef.current.position.set(
                    -TUNNEL_SIZE / 2 + BALL_RADIUS,
                    position,
                    playerRef.current.position.z
                );
                targetY.current = position;
                break;
            case 'rightWall':
                playerRef.current.position.set(
                    TUNNEL_SIZE / 2 - BALL_RADIUS,
                    position,
                    playerRef.current.position.z
                );
                targetY.current = position;
                break;
        }
    };

    // Rotate camera by 90 degrees in the specified direction
    const rotateCameraRelative = (direction: 'left' | 'right') => {
        // Get the current rotation around Z axis
        const currentRotation = targetCameraRotation.current.z;

        // Determine the amount to rotate based on direction
        // right = counterclockwise = +90 degrees
        // left = clockwise = -90 degrees
        const rotationAmount = direction === 'right' ? Math.PI / 2 : -Math.PI / 2;

        // Calculate the new rotation angle
        const newRotation = currentRotation + rotationAmount;

        // Set the new rotation
        targetCameraRotation.current.set(0, 0, newRotation);
        rotationProgress.current = 1.0; // Trigger smooth transition

        console.log(`Rotating camera ${direction}, from ${currentRotation} to ${newRotation}`);
    };

    // Move player to a specific global lane
    const moveToGlobalLane = (globalLane: number, direction: 'left' | 'right') => {
        if (!playerRef.current) return;

        // Get surface and local lane from global lane
        const { surface, localLane } = getSurfaceAndLocalLane(globalLane);

        // If surface is changing, we need to handle transition
        if (surface !== currentSurface) {
            console.log(`Transitioning: ${currentSurface} -> ${surface} (global lane: ${globalLane}, local lane: ${localLane})`);

            // Update surface first
            setCurrentSurface(surface);

            // Rotate camera based on movement direction
            rotateCameraRelative(direction);

            // Reset movement state
            playerVelocity.current.set(0, 0, 0);
            isJumping.current = false;
        }

        // Update lane
        setCurrentLane(localLane);

        // Position player
        positionPlayerAtLane(surface, localLane);

        // Mark as moving (for animation)
        isMoving.current = true;
    };

    // Set up keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState === 'start') {
                setGameState('playing');
                return;
            }

            if (gameState !== 'playing') return;

            // Get current global lane
            const currentGlobalLane = getGlobalLane(currentSurface, currentLane);

            // Log key events for left/right movement
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd') {
                console.log('Movement Key:', {
                    key: e.key,
                    currentSurface,
                    currentLane,
                    globalLane: currentGlobalLane,
                    isMoving: isMoving.current,
                    isJumping: isJumping.current
                });
            }

            // Prevent lane changes if already moving between lanes
            // But allow direction keys to be processed for logging
            if (isMoving.current) return;

            // Handle movement with new global lane system
            if (e.key === 'ArrowRight' || e.key === 'd') {
                // Move clockwise (increment lane)
                const nextGlobalLane = (currentGlobalLane + 1) % TOTAL_LANES;
                moveToGlobalLane(nextGlobalLane, 'right');
            } else if (e.key === 'ArrowLeft' || e.key === 'a') {
                // Move counter-clockwise (decrement lane)
                const nextGlobalLane = (currentGlobalLane - 1 + TOTAL_LANES) % TOTAL_LANES;
                moveToGlobalLane(nextGlobalLane, 'left');
            }

            // Jump with space
            if (e.key === ' ' && !isJumping.current) {
                isJumping.current = true;
                // Apply jump force in direction opposite to gravity
                const gravityDir = getGravityDirection();
                playerVelocity.current.x = -gravityDir.x * JUMP_FORCE;
                playerVelocity.current.y = -gravityDir.y * JUMP_FORCE;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            // Restart game
            if (e.key === 'r' && gameState === 'gameOver') {
                // Reset game state
                setGameState('playing');
                setScore(0);

                // Reset to floor, middle lane
                const initialLane = 2; // Middle lane of floor
                setCurrentSurface('floor');
                setCurrentLane(initialLane);

                // Position player
                positionPlayerAtLane('floor', initialLane);
                tunnelPosition.current = 0;

                // Reset camera rotation
                targetCameraRotation.current = new Euler(0, 0, 0);
                rotationProgress.current = 0;

                // Reset falling state
                setIsFallingThroughGap(false);

                // Reset player state
                if (playerRef.current) {
                    playerVelocity.current.set(0, 0, 0);
                    isJumping.current = false;
                    isMoving.current = false;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [
        gameState,
        currentLane,
        currentSurface,
        LANE_COUNT,
        JUMP_FORCE,
        TUNNEL_SIZE,
        BALL_RADIUS
    ]);

    return {
        getGravityDirection,
        snapToSurface,
        getSurfaceAndLocalLane, // Export for testing/debugging
        getGlobalLane, // Export for testing/debugging
        moveToGlobalLane // Export for programmatic movement
    };
} 