import { useEffect, MutableRefObject } from 'react';
import { Vector3, Mesh, Euler, Group } from 'three';

// Surface types the player can run on
export type Surface = 'floor' | 'ceiling' | 'leftWall' | 'rightWall';

// Game states
export type GameState = 'start' | 'playing' | 'gameOver';

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

    // Handle transition to a different surface
    const transitionToSurface = (newSurface: Surface) => {
        if (newSurface === currentSurface || !playerRef.current) return;

        const previousSurface = currentSurface; // Store previous surface for logic below

        console.log('Surface Transition:', {
            from: previousSurface,
            to: newSurface,
            playerPosition: playerRef.current.position.clone(), // Clone for safety
            currentLane
        });

        // Set camera rotation based on surface
        const euler = new Euler();
        let targetLane = currentLane; // Default to keeping current lane

        switch (newSurface) {
            case 'floor':
                euler.set(0, 0, 0);
                // From Left Wall (bottom) -> land on leftmost lane (0)
                // From Right Wall (bottom) -> land on rightmost lane (LANE_COUNT - 1)
                if (previousSurface === 'leftWall') targetLane = 0;
                else if (previousSurface === 'rightWall') targetLane = LANE_COUNT - 1;
                // From ceiling -> keep current lane for continuous running

                setCurrentLane(targetLane);
                playerRef.current.position.set(
                    getLanePosition(targetLane),
                    -TUNNEL_SIZE / 2 + BALL_RADIUS,
                    playerRef.current.position.z
                );
                targetX.current = getLanePosition(targetLane);
                break;

            case 'ceiling':
                euler.set(0, 0, Math.PI);
                if (previousSurface === 'leftWall') {
                    // From Left Wall (top) -> land on leftmost lane (0)
                    targetLane = 0;
                } else if (previousSurface === 'rightWall') {
                    // From Right Wall (top) -> land on rightmost lane (LANE_COUNT - 1)
                    targetLane = LANE_COUNT - 1;
                }
                // From floor -> keep current lane for continuous running
                console.log("Setting up ceiling transition, targetLane:", targetLane);

                setCurrentLane(targetLane);
                playerRef.current.position.set(
                    getLanePosition(targetLane),
                    TUNNEL_SIZE / 2 - BALL_RADIUS,
                    playerRef.current.position.z
                );
                targetX.current = getLanePosition(targetLane);
                break;

            case 'leftWall':
                euler.set(0, 0, -Math.PI / 2);
                // From Floor (left edge) or Ceiling (left edge) -> land on top lane (0)
                if (previousSurface === 'floor' || previousSurface === 'ceiling') {
                    targetLane = 0;
                }
                console.log("Setting up left wall transition, targetLane:", targetLane);

                setCurrentLane(targetLane);
                playerRef.current.position.set(
                    -TUNNEL_SIZE / 2 + BALL_RADIUS,
                    getLanePosition(targetLane),
                    playerRef.current.position.z
                );
                targetY.current = getLanePosition(targetLane);
                break;

            case 'rightWall':
                euler.set(0, 0, Math.PI / 2);
                // From Floor (right edge) or Ceiling (right edge) -> land on top lane (0)
                if (previousSurface === 'floor' || previousSurface === 'ceiling') {
                    targetLane = 0;
                }
                console.log("Setting up right wall transition, targetLane:", targetLane);

                setCurrentLane(targetLane);
                playerRef.current.position.set(
                    TUNNEL_SIZE / 2 - BALL_RADIUS,
                    getLanePosition(targetLane),
                    playerRef.current.position.z
                );
                targetY.current = getLanePosition(targetLane);
                break;
        }

        // Update surface *after* positioning
        setCurrentSurface(newSurface);
        targetCameraRotation.current = euler;
        rotationProgress.current = 1.0; // Keep the smooth transition

        // Reset player velocity and state
        playerVelocity.current.set(0, 0, 0);
        isJumping.current = false;
        isMoving.current = false; // Reset movement state on transition
    };

    // Set up keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState === 'start') {
                setGameState('playing');
                return;
            }

            if (gameState !== 'playing') return;

            // Log key events for left/right movement
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd') {
                console.log('Movement Key:', {
                    key: e.key,
                    currentSurface,
                    currentLane,
                    isMoving: isMoving.current,
                    isJumping: isJumping.current
                });
            }

            // Only prevent lane changes if we're already in the process of moving between lanes
            // But allow transitions between surfaces even during lane movement
            const isWallTransition =
                (e.key === 'ArrowLeft' || e.key === 'a') && currentLane === 0 ||
                (e.key === 'ArrowRight' || e.key === 'd') && currentLane === LANE_COUNT - 1;

            // Allow wall transitions even during movement, but prevent lane changes if already moving
            if (isMoving.current && !isWallTransition) return;

            // Handle movement based on current surface
            switch (currentSurface) {
                case 'floor':
                    // On floor, left/right to move and at edges transition to walls
                    if ((e.key === 'ArrowLeft' || e.key === 'a')) {
                        if (currentLane > 0) {
                            // Normal movement
                            const newLane = currentLane - 1;
                            setCurrentLane(newLane);
                            targetX.current = getLanePosition(newLane);
                            isMoving.current = true;
                            if (!isJumping.current) {
                                snapToSurface();
                            }
                        } else {
                            // At leftmost lane, transition to left wall
                            console.log("Transitioning: floor -> leftWall");
                            transitionToSurface('leftWall');
                        }
                    } else if ((e.key === 'ArrowRight' || e.key === 'd')) {
                        if (currentLane < LANE_COUNT - 1) {
                            // Normal movement
                            const newLane = currentLane + 1;
                            setCurrentLane(newLane);
                            targetX.current = getLanePosition(newLane);
                            isMoving.current = true;
                            if (!isJumping.current) {
                                snapToSurface();
                            }
                        } else {
                            // At rightmost lane, transition to right wall
                            console.log("Transitioning: floor -> rightWall");
                            transitionToSurface('rightWall');
                        }
                    }
                    break;

                case 'rightWall':
                    // On right wall, pressing LEFT goes UP (towards ceiling), RIGHT goes DOWN (towards floor)
                    if ((e.key === 'ArrowLeft' || e.key === 'a')) {
                        // UP movement (towards ceiling)
                        if (currentLane > 0) {
                            // Normal movement up the wall
                            const newLane = currentLane - 1;
                            setCurrentLane(newLane);
                            targetY.current = getLanePosition(newLane);
                            isMoving.current = true;
                            if (!isJumping.current) {
                                snapToSurface();
                            }
                        } else {
                            // At top lane (0), transition to ceiling
                            console.log("Transitioning: rightWall -> ceiling");
                            transitionToSurface('ceiling');
                        }
                    } else if ((e.key === 'ArrowRight' || e.key === 'd')) {
                        // DOWN movement (towards floor)
                        if (currentLane < LANE_COUNT - 1) {
                            // Normal movement down the wall
                            const newLane = currentLane + 1;
                            setCurrentLane(newLane);
                            targetY.current = getLanePosition(newLane);
                            isMoving.current = true;
                            if (!isJumping.current) {
                                snapToSurface();
                            }
                        } else {
                            // At bottom lane (4), transition to floor
                            console.log("Transitioning: rightWall -> floor");
                            transitionToSurface('floor');
                        }
                    }
                    break;

                case 'ceiling':
                    // On ceiling, left/right to move and at edges transition to walls
                    if ((e.key === 'ArrowLeft' || e.key === 'a')) {
                        if (currentLane > 0) {
                            // Normal movement (left on ceiling)
                            const newLane = currentLane - 1;
                            setCurrentLane(newLane);
                            targetX.current = getLanePosition(newLane);
                            isMoving.current = true;
                            if (!isJumping.current) {
                                snapToSurface();
                            }
                        } else {
                            // At leftmost lane, transition to left wall
                            console.log("Transitioning: ceiling -> leftWall");
                            transitionToSurface('leftWall');
                        }
                    } else if ((e.key === 'ArrowRight' || e.key === 'd')) {
                        if (currentLane < LANE_COUNT - 1) {
                            // Normal movement (right on ceiling)
                            const newLane = currentLane + 1;
                            setCurrentLane(newLane);
                            targetX.current = getLanePosition(newLane);
                            isMoving.current = true;
                            if (!isJumping.current) {
                                snapToSurface();
                            }
                        } else {
                            // At rightmost lane, transition to right wall
                            console.log("Transitioning: ceiling -> rightWall");
                            transitionToSurface('rightWall');
                        }
                    }
                    break;

                case 'leftWall':
                    // On left wall, pressing RIGHT goes UP (towards ceiling), LEFT goes DOWN (towards floor)
                    if ((e.key === 'ArrowRight' || e.key === 'd')) {
                        // UP movement (towards ceiling)
                        if (currentLane > 0) {
                            // Normal movement up the wall
                            const newLane = currentLane - 1;
                            setCurrentLane(newLane);
                            targetY.current = getLanePosition(newLane);
                            isMoving.current = true;
                            if (!isJumping.current) {
                                snapToSurface();
                            }
                        } else {
                            // At top lane (0), transition to ceiling
                            console.log("Transitioning: leftWall -> ceiling");
                            transitionToSurface('ceiling');
                        }
                    } else if ((e.key === 'ArrowLeft' || e.key === 'a')) {
                        // DOWN movement (towards floor)
                        if (currentLane < LANE_COUNT - 1) {
                            // Normal movement down the wall
                            const newLane = currentLane + 1;
                            setCurrentLane(newLane);
                            targetY.current = getLanePosition(newLane);
                            isMoving.current = true;
                            if (!isJumping.current) {
                                snapToSurface();
                            }
                        } else {
                            // At bottom lane (4), transition to floor
                            console.log("Transitioning: leftWall -> floor");
                            transitionToSurface('floor');
                        }
                    }
                    break;
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
                setCurrentLane(2);
                setCurrentSurface('floor');
                targetX.current = getLanePosition(2);
                tunnelPosition.current = 0;

                // Reset camera rotation
                targetCameraRotation.current = new Euler(0, 0, 0);
                rotationProgress.current = 0;

                // Reset falling state
                setIsFallingThroughGap(false);

                // Reset player
                if (playerRef.current) {
                    playerRef.current.position.set(getLanePosition(2), -TUNNEL_SIZE / 2 + BALL_RADIUS, 0);
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
        transitionToSurface
    };
} 