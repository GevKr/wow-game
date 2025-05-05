import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Stars } from '@react-three/drei';
import { Vector3, Mesh, Group, DoubleSide, Euler, Matrix4 } from 'three';

// Game configuration
const MOVE_SPEED = 6; // Speed the character runs forward
const SIDE_SPEED = 8; // Speed of side movement
const JUMP_FORCE = 10;
const GRAVITY = 25;
const TUNNEL_SIZE = 5; // Size of tunnel
const TILE_SIZE = 1; // Size of floor/wall tiles
const TUNNEL_LENGTH = 150; // Longer tunnel
const BALL_RADIUS = 0.25; // Character size
const FLOOR_COLORS = ["#ff91c6", "#ff7fb8", "#ff69a9", "#ff7fb8", "#ff91c6"]; // Pink floor colors
const CEILING_COLOR = "#ff4d94"; // Darker pink for ceiling
const WALL_COLOR = "#ff8c42"; // Orange for walls
const LANE_COUNT = 5; // Number of lanes

// Surface types the player can run on
type Surface = 'floor' | 'ceiling' | 'leftWall' | 'rightWall';

// Lane positions
const getLanePosition = (lane: number, totalLanes: number = LANE_COUNT) => {
    const laneWidth = TUNNEL_SIZE / totalLanes;
    return -TUNNEL_SIZE / 2 + laneWidth / 2 + lane * laneWidth;
};

// Define tile type
type Tile = {
    position: [number, number, number]; // x, y, z
    size: [number, number]; // width, length
    type: Surface; // Type of surface
    color: string;
    exists: boolean; // Whether this tile exists or is a gap
};

// Game states
type GameState = 'start' | 'playing' | 'gameOver';

export function Game2D() {
    const { camera } = useThree();
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<GameState>('start');
    const [currentLane, setCurrentLane] = useState(2); // Start in middle lane (0-4)
    const [currentSurface, setCurrentSurface] = useState<Surface>('floor');
    const [isFallingThroughGap, setIsFallingThroughGap] = useState(false);

    // Player state
    const playerRef = useRef<Mesh>(null);
    const playerVelocity = useRef(new Vector3(0, 0, 0));
    const isJumping = useRef(false);
    const isMoving = useRef(false);
    const targetX = useRef(getLanePosition(2));
    const targetY = useRef(0); // Added for wall movement

    // Camera state
    const cameraRotation = useRef(new Euler(0, 0, 0));
    const targetCameraRotation = useRef(new Euler(0, 0, 0));
    const rotationProgress = useRef(0);

    // World state
    const tunnelRef = useRef<Group>(null);
    const tunnelPosition = useRef(0); // Tracks how far player has moved

    // Generate tunnel tiles with explicit gaps
    const generateTunnel = () => {
        const tiles: Tile[] = [];
        const totalLanes = 5;
        const length = TUNNEL_LENGTH;

        // Generate tiles for the tunnel
        for (let z = 0; z < length; z++) {
            // Create phases of difficulty instead of linear progression
            let phaseDifficulty = 0;

            // Safe zone at the start
            if (z < 15) {
                phaseDifficulty = 0; // No gaps
            }
            // Intro phase - few gaps
            else if (z < 40) {
                phaseDifficulty = 0.2;
            }
            // Medium sections with varying difficulty
            else {
                // Create wave patterns of difficulty that cycle
                const cyclePosition = z % 50; // Difficulty cycles every 50 units

                if (cyclePosition < 15) {
                    // Easier section at beginning of cycle
                    phaseDifficulty = 0.2;
                } else if (cyclePosition < 35) {
                    // Hard section in middle of cycle
                    phaseDifficulty = 0.6;
                } else {
                    // Medium section at end of cycle
                    phaseDifficulty = 0.4;
                }

                // Random difficulty spikes
                if (z > 80 && Math.random() < 0.05) {
                    // 5% chance of extra difficult section
                    phaseDifficulty = 0.8;
                }
            }

            // Create a row of floor tiles
            for (let x = 0; x < totalLanes; x++) {
                // Create a pattern of missing floor tiles to make visible gaps
                let tileExists = true;

                // Pattern-based gaps
                if (z > 15) {
                    // Create predictable patterns at intervals
                    if (z % 5 === 0) {
                        // Every 5th row has alternating tiles missing
                        tileExists = x % 2 !== 0;
                    }
                    else if (z % 15 === 0) {
                        // Every 15th row only has middle lane
                        tileExists = x === 2;
                    }
                    // Random gaps based on phase difficulty
                    else if (Math.random() < phaseDifficulty) {
                        tileExists = false;
                    }

                    // Special challenge patterns
                    if (z % 40 === 0 && z > 50) {
                        // Create zigzag pattern
                        tileExists = (x + Math.floor(z / 10)) % 2 === 0;
                    }
                    else if (z % 75 === 0 && z > 75) {
                        // Only edge tiles exist - hard jump
                        tileExists = (x === 0 || x === 4);
                    }

                    // Ensure there's always at least one safe path
                    const existingGapsInRow = tiles.filter(t =>
                        t.type === 'floor' &&
                        t.position[2] === -z &&
                        !t.exists
                    ).length;

                    // Don't make all tiles in a row gaps (impossible to pass)
                    if (!tileExists && existingGapsInRow >= totalLanes - 1) {
                        tileExists = true;
                    }
                }

                // Floor tile
                tiles.push({
                    position: [
                        getLanePosition(x, totalLanes),
                        -TUNNEL_SIZE / 2, // Bottom
                        -z
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.9, TILE_SIZE * 0.9] as [number, number],
                    type: 'floor',
                    color: tileExists ? FLOOR_COLORS[x] : 'black',
                    exists: tileExists
                });

                // Ceiling tile (always exists)
                tiles.push({
                    position: [
                        getLanePosition(x, totalLanes),
                        TUNNEL_SIZE / 2, // Top
                        -z
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.9, TILE_SIZE * 0.9] as [number, number],
                    type: 'ceiling',
                    color: CEILING_COLOR,
                    exists: true
                });
            }

            // Left and right wall tiles
            for (let y = 0; y < totalLanes; y++) {
                // Left wall
                tiles.push({
                    position: [
                        -TUNNEL_SIZE / 2, // Left side
                        getLanePosition(y, totalLanes),
                        -z
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.9, TILE_SIZE * 0.9] as [number, number],
                    type: 'leftWall',
                    color: WALL_COLOR,
                    exists: true
                });

                // Right wall
                tiles.push({
                    position: [
                        TUNNEL_SIZE / 2, // Right side
                        getLanePosition(y, totalLanes),
                        -z
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.9, TILE_SIZE * 0.9] as [number, number],
                    type: 'rightWall',
                    color: WALL_COLOR,
                    exists: true
                });
            }
        }

        return tiles;
    };

    // Create tunnel segments
    const tunnelTiles = useMemo(() => {
        return generateTunnel();
    }, []);

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

        // Set camera rotation based on surface
        const euler = new Euler();

        switch (newSurface) {
            case 'floor':
                euler.set(0, 0, 0);
                // Always position at the current lane when transitioning to floor
                playerRef.current.position.set(
                    getLanePosition(currentLane),
                    -TUNNEL_SIZE / 2 + BALL_RADIUS,
                    playerRef.current.position.z
                );
                break;

            case 'ceiling':
                euler.set(0, 0, Math.PI);
                // Always position at the current lane when transitioning to ceiling
                playerRef.current.position.set(
                    getLanePosition(currentLane),
                    TUNNEL_SIZE / 2 - BALL_RADIUS,
                    playerRef.current.position.z
                );
                break;

            case 'leftWall':
                euler.set(0, 0, -Math.PI / 2);
                // Always position at the current lane when transitioning to left wall
                playerRef.current.position.set(
                    -TUNNEL_SIZE / 2 + BALL_RADIUS,
                    getLanePosition(currentLane),
                    playerRef.current.position.z
                );
                break;

            case 'rightWall':
                euler.set(0, 0, Math.PI / 2);
                // When climbing onto right wall, reset to leftmost lane (0)
                if (currentSurface === 'floor') {
                    // Reset to leftmost lane
                    setCurrentLane(0);
                    playerRef.current.position.set(
                        TUNNEL_SIZE / 2 - BALL_RADIUS,
                        getLanePosition(0), // Position at leftmost lane
                        playerRef.current.position.z
                    );
                    targetY.current = getLanePosition(0); // Set target Y to leftmost lane
                } else {
                    // Normal transition from other surfaces
                    playerRef.current.position.set(
                        TUNNEL_SIZE / 2 - BALL_RADIUS,
                        getLanePosition(currentLane),
                        playerRef.current.position.z
                    );
                }
                break;
        }

        // Update surface after positioning the player
        setCurrentSurface(newSurface);
        targetCameraRotation.current = euler;
        rotationProgress.current = 1.0; // 1 second duration for animation (slower transition)

        // Set the appropriate target position based on current lane
        targetX.current = getLanePosition(currentLane);
        if (newSurface !== 'rightWall' || currentSurface !== 'floor') {
            targetY.current = getLanePosition(currentLane);
        }

        // Reset player velocity to prevent residual momentum
        playerVelocity.current.set(0, 0, 0);
        isJumping.current = false;

        // Allow lane movement during transition
        isMoving.current = false;
    };

    // Check if player is on a valid tile of current surface
    const isPlayerOnTile = () => {
        if (!playerRef.current) return false;

        // If falling through a gap, keep falling
        if (isFallingThroughGap) return false;

        const playerPos = playerRef.current.position;
        const posZ = tunnelPosition.current;

        // Find appropriate tile based on current surface
        let tile;

        switch (currentSurface) {
            case 'floor':
                tile = tunnelTiles.find(t =>
                    t.type === 'floor' &&
                    Math.abs(t.position[0] - playerPos.x) < TILE_SIZE / 2 &&
                    Math.abs(t.position[2] + posZ - playerPos.z) < TILE_SIZE / 2
                );
                break;

            case 'ceiling':
                tile = tunnelTiles.find(t =>
                    t.type === 'ceiling' &&
                    Math.abs(t.position[0] - playerPos.x) < TILE_SIZE / 2 &&
                    Math.abs(t.position[2] + posZ - playerPos.z) < TILE_SIZE / 2
                );
                break;

            case 'leftWall':
                tile = tunnelTiles.find(t =>
                    t.type === 'leftWall' &&
                    Math.abs(t.position[1] - playerPos.y) < TILE_SIZE / 2 &&
                    Math.abs(t.position[2] + posZ - playerPos.z) < TILE_SIZE / 2
                );
                break;

            case 'rightWall':
                tile = tunnelTiles.find(t =>
                    t.type === 'rightWall' &&
                    Math.abs(t.position[1] - playerPos.y) < TILE_SIZE / 2 &&
                    Math.abs(t.position[2] + posZ - playerPos.z) < TILE_SIZE / 2
                );
                break;
        }

        // Return true if there's a tile and it exists (not a gap)
        return tile !== undefined && tile.exists;
    };

    // Set up controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState === 'start') {
                setGameState('playing');
                return;
            }

            if (gameState !== 'playing') return;

            // Only prevent lane changes if we're already in the process of moving between lanes
            // But allow transitions between surfaces even during lane movement
            const isWallTransition =
                (e.key === 'ArrowLeft' || e.key === 'a') && currentLane === 0 && currentSurface === 'floor' ||
                (e.key === 'ArrowRight' || e.key === 'd') && currentLane === LANE_COUNT - 1 && currentSurface === 'floor' ||
                (e.key === 'ArrowLeft' || e.key === 'a') && currentLane === LANE_COUNT - 1 && currentSurface === 'leftWall' ||
                (e.key === 'ArrowRight' || e.key === 'd') && currentLane === 0 && currentSurface === 'rightWall';

            // Allow wall transitions even during movement, but prevent lane changes if already moving
            if (isMoving.current && !isWallTransition) return;

            // Handle movement based on current surface
            switch (currentSurface) {
                case 'floor':
                    // On floor, left/right to move and at edges to climb walls
                    if ((e.key === 'ArrowLeft' || e.key === 'a')) {
                        if (currentLane > 0) {
                            // Normal movement
                            const newLane = currentLane - 1;
                            setCurrentLane(newLane);
                            targetX.current = getLanePosition(newLane);
                            isMoving.current = true;
                            // Ensure proper alignment with surface
                            snapToSurface();
                        } else {
                            // At leftmost lane, climb the left wall
                            transitionToSurface('leftWall');
                        }
                    } else if ((e.key === 'ArrowRight' || e.key === 'd')) {
                        if (currentLane < LANE_COUNT - 1) {
                            // Normal movement
                            const newLane = currentLane + 1;
                            setCurrentLane(newLane);
                            targetX.current = getLanePosition(newLane);
                            isMoving.current = true;
                            // Ensure proper alignment with surface
                            snapToSurface();
                        } else {
                            // At rightmost lane, climb the right wall
                            transitionToSurface('rightWall');
                        }
                    }
                    break;

                case 'leftWall':
                    // When on left wall, keep control scheme consistent with floor
                    if ((e.key === 'ArrowLeft' || e.key === 'a')) {
                        // Left on keyboard = lower Y position (down)
                        if (currentLane < LANE_COUNT - 1) {
                            const newLane = currentLane + 1;
                            setCurrentLane(newLane);
                            targetY.current = getLanePosition(newLane);
                            isMoving.current = true;
                            // Ensure proper alignment with surface
                            snapToSurface();
                        } else {
                            // At topmost lane of left wall, transition to floor
                            transitionToSurface('floor');
                        }
                    } else if ((e.key === 'ArrowRight' || e.key === 'd')) {
                        // Right on keyboard = higher Y position (up)
                        if (currentLane > 0) {
                            const newLane = currentLane - 1;
                            setCurrentLane(newLane);
                            targetY.current = getLanePosition(newLane);
                            isMoving.current = true;
                            // Ensure proper alignment with surface
                            snapToSurface();
                        }
                    }
                    break;

                case 'rightWall':
                    // When on right wall, controls should be mirrored from left wall
                    if ((e.key === 'ArrowRight' || e.key === 'd')) {
                        // Right on keyboard = lower Y position (down)
                        if (currentLane < LANE_COUNT - 1) {
                            const newLane = currentLane + 1;
                            setCurrentLane(newLane);
                            targetY.current = getLanePosition(newLane);
                            isMoving.current = true;
                            // Ensure proper alignment with surface
                            snapToSurface();
                        } else {
                            // At bottom-most lane of right wall, transition to floor
                            transitionToSurface('floor');
                        }
                    } else if ((e.key === 'ArrowLeft' || e.key === 'a')) {
                        // Left on keyboard = higher Y position (up)
                        if (currentLane > 0) {
                            const newLane = currentLane - 1;
                            setCurrentLane(newLane);
                            targetY.current = getLanePosition(newLane);
                            isMoving.current = true;
                            // Ensure proper alignment with surface
                            snapToSurface();
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
                cameraRotation.current = new Euler(0, 0, 0);
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
    }, [gameState, currentLane, currentSurface]);

    // Reset isMoving flag when a transition completes
    useEffect(() => {
        // No need for interval-based reset, we'll handle this directly in the useFrame
        return () => { };
    }, []);

    // Main game loop
    useFrame((state, delta) => {
        if (gameState === 'gameOver') return;

        if (gameState === 'playing' && playerRef.current) {
            const playerPos = playerRef.current.position;
            const gravityDir = getGravityDirection();

            // Auto-move forward at consistent speed regardless of animation state
            const forwardSpeed = MOVE_SPEED * delta;
            tunnelPosition.current += forwardSpeed;

            // Update score
            setScore(Math.floor(tunnelPosition.current));

            // Move player through tunnel
            if (tunnelRef.current) {
                tunnelRef.current.position.z = tunnelPosition.current;
            }

            // Handle camera rotation animation
            if (rotationProgress.current > 0) {
                // Very slow rotation for smoother transition
                const step = Math.min(delta * 1.0, rotationProgress.current); // Much slower rotation
                rotationProgress.current -= step;

                // Interpolate rotation with easing (smoother transition)
                const t = Math.sin((1 - rotationProgress.current) * Math.PI / 2); // Easing function
                cameraRotation.current.x = (1 - t) * cameraRotation.current.x + t * targetCameraRotation.current.x;
                cameraRotation.current.y = (1 - t) * cameraRotation.current.y + t * targetCameraRotation.current.y;
                cameraRotation.current.z = (1 - t) * cameraRotation.current.z + t * targetCameraRotation.current.z;

                // Apply rotation to camera view
                camera.rotation.copy(cameraRotation.current);

                // Also adjust up vector for proper orientation
                const rotMatrix = new Matrix4().makeRotationFromEuler(cameraRotation.current);
                camera.up.set(0, 1, 0).applyMatrix4(rotMatrix);

                // If rotation completes this frame, reset isMoving to allow lane changes
                if (rotationProgress.current <= 0) {
                    isMoving.current = false;
                }
            }

            // Handle side movement (X axis for floor, Y axis for walls)
            if (isMoving.current) {
                if (currentSurface === 'floor' || currentSurface === 'ceiling') {
                    // X-axis movement for floor and ceiling
                    const step = SIDE_SPEED * delta;
                    const diff = targetX.current - playerPos.x;

                    if (Math.abs(diff) <= step) {
                        // Reached target
                        playerPos.x = targetX.current;
                        isMoving.current = false;
                    } else {
                        // Move toward target
                        playerPos.x += Math.sign(diff) * step;
                    }
                } else if (currentSurface === 'leftWall' || currentSurface === 'rightWall') {
                    // Y-axis movement for walls
                    const step = SIDE_SPEED * delta;
                    const diff = targetY.current - playerPos.y;

                    if (Math.abs(diff) <= step) {
                        // Reached target
                        playerPos.y = targetY.current;
                        isMoving.current = false;
                    } else {
                        // Move toward target
                        playerPos.y += Math.sign(diff) * step;
                    }
                }
            }

            // Apply gravity in the appropriate direction
            playerVelocity.current.x += gravityDir.x * GRAVITY * delta;
            playerVelocity.current.y += gravityDir.y * GRAVITY * delta;

            // Update position with velocity
            playerPos.x += playerVelocity.current.x * delta;
            playerPos.y += playerVelocity.current.y * delta;

            // Check for collision with the current surface
            let surfaceLevel = 0;
            let collisionAxis = '';

            switch (currentSurface) {
                case 'floor':
                    surfaceLevel = -TUNNEL_SIZE / 2 + BALL_RADIUS;
                    collisionAxis = 'y';
                    break;
                case 'ceiling':
                    surfaceLevel = TUNNEL_SIZE / 2 - BALL_RADIUS;
                    collisionAxis = 'y';
                    break;
                case 'leftWall':
                    surfaceLevel = -TUNNEL_SIZE / 2 + BALL_RADIUS;
                    collisionAxis = 'x';
                    break;
                case 'rightWall':
                    surfaceLevel = TUNNEL_SIZE / 2 - BALL_RADIUS;
                    collisionAxis = 'x';
                    break;
            }

            // Check for gap detection
            const onSurface = isPlayerOnTile();

            // If we're near the surface but over a gap, mark as falling through
            const nearSurface = (
                (collisionAxis === 'y' && Math.abs(playerPos.y - surfaceLevel) < 0.2) ||
                (collisionAxis === 'x' && Math.abs(playerPos.x - surfaceLevel) < 0.2)
            );

            if (!onSurface && nearSurface && !isFallingThroughGap) {
                setIsFallingThroughGap(true);
            }

            // Handle collision with surface - only if not falling through a gap
            if (onSurface && !isFallingThroughGap) {
                if (collisionAxis === 'y') {
                    // Floor/ceiling collision
                    const isBelow = (currentSurface === 'floor' && playerPos.y < surfaceLevel) ||
                        (currentSurface === 'ceiling' && playerPos.y > surfaceLevel);

                    if (isBelow) {
                        playerPos.y = surfaceLevel;
                        playerVelocity.current.y = 0;
                        isJumping.current = false;
                    }
                } else {
                    // Wall collision
                    const isInside = (currentSurface === 'leftWall' && playerPos.x < surfaceLevel) ||
                        (currentSurface === 'rightWall' && playerPos.x > surfaceLevel);

                    if (isInside) {
                        playerPos.x = surfaceLevel;
                        playerVelocity.current.x = 0;
                        isJumping.current = false;
                    }
                }
            }

            // If not jumping, ensure we're sticking to the current surface
            // This helps prevent sliding after transitions
            if (!isJumping.current && !isMoving.current && onSurface) {
                if (collisionAxis === 'y') {
                    playerPos.y = surfaceLevel;
                    playerVelocity.current.y = 0;
                } else {
                    playerPos.x = surfaceLevel;
                    playerVelocity.current.x = 0;
                }
            }

            // Check if player fell too far (in any direction)
            const outOfBounds =
                playerPos.y < -TUNNEL_SIZE * 2 ||
                playerPos.y > TUNNEL_SIZE * 2 ||
                playerPos.x < -TUNNEL_SIZE * 2 ||
                playerPos.x > TUNNEL_SIZE * 2;

            if (outOfBounds) {
                setGameState('gameOver');
                setIsFallingThroughGap(false);
            }
        }

        // Keep camera position fixed (but rotation changes)
        camera.position.set(0, 0, 5);
        camera.lookAt(0, 0, 0);
    });

    return (
        <>
            {/* Space background */}
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            {/* Score display */}
            <Text
                position={[0, 2, 0]}
                color="white"
                fontSize={0.5}
                anchorX="center"
                anchorY="middle"
            >
                {`Score: ${score}`}
            </Text>

            {/* Start screen */}
            {gameState === 'start' && (
                <group position={[0, 0, -5]}>
                    <Text
                        position={[0, 1, 0]}
                        color="white"
                        fontSize={0.7}
                        anchorX="center"
                        anchorY="middle"
                    >
                        RUN 3D
                    </Text>
                    <Text
                        position={[0, 0, 0]}
                        color="white"
                        fontSize={0.4}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Press any key to start
                    </Text>
                    <Text
                        position={[0, -1, 0]}
                        color="#88ccff"
                        fontSize={0.3}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Arrows to move, Space to jump
                    </Text>
                </group>
            )}

            {/* Game over screen */}
            {gameState === 'gameOver' && (
                <>
                    <Text
                        position={[0, 0.5, 0]}
                        color="red"
                        fontSize={1}
                        anchorX="center"
                        anchorY="middle"
                    >
                        GAME OVER
                    </Text>
                    <Text
                        position={[0, -0.5, 0]}
                        color="white"
                        fontSize={0.4}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Press R to restart
                    </Text>
                </>
            )}

            {/* Player character */}
            <mesh
                ref={playerRef}
                position={[getLanePosition(2), -TUNNEL_SIZE / 2 + BALL_RADIUS, 0]}
            >
                <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
                <meshStandardMaterial color="#ff3030" emissive="#ff0000" emissiveIntensity={0.3} />
            </mesh>

            {/* Tunnel */}
            <group ref={tunnelRef}>
                {tunnelTiles.map((tile, index) => {
                    // Skip rendering missing tiles completely
                    if (!tile.exists) return null;

                    // Determine rotation based on tile type
                    let rotation = [0, 0, 0];
                    if (tile.type === 'floor') rotation = [Math.PI / 2, 0, 0];
                    else if (tile.type === 'ceiling') rotation = [-Math.PI / 2, 0, 0];
                    else if (tile.type === 'leftWall') rotation = [0, Math.PI / 2, 0];
                    else if (tile.type === 'rightWall') rotation = [0, -Math.PI / 2, 0];

                    // Add depth-based color variation for gradient effect
                    const depthFactor = Math.abs(tile.position[2]) / TUNNEL_LENGTH;

                    // Add pulsing effect for walls
                    let emissiveIntensity = 0.2 + depthFactor * 0.3;
                    const useColor = tile.color;

                    if (tile.type === 'leftWall' || tile.type === 'rightWall') {
                        const pulseIntensity = Math.sin(tile.position[2] * 0.2) * 0.2 + 0.8;
                        emissiveIntensity *= pulseIntensity;
                    }

                    return (
                        <mesh
                            key={`tile-${tile.type}-${index}`}
                            position={tile.position}
                            rotation={rotation as [number, number, number]}
                        >
                            <planeGeometry args={tile.size} />
                            <meshStandardMaterial
                                color={useColor}
                                side={DoubleSide}
                                emissive={tile.color}
                                emissiveIntensity={emissiveIntensity}
                                metalness={0.2}
                                roughness={0.8 - depthFactor * 0.3}
                            />
                        </mesh>
                    );
                })}
            </group>

            {/* Instructions */}
            {gameState === 'playing' && score < 15 && (
                <group position={[0, 0, -15]}>
                    <mesh position={[0, 0, 0]}>
                        <planeGeometry args={[12, 7]} />
                        <meshBasicMaterial color="#000033" opacity={0.8} transparent={true} />
                    </mesh>
                    <Text
                        position={[0, 2, 0.1]}
                        color="white"
                        fontSize={0.4}
                        anchorX="center"
                        anchorY="middle"
                    >
                        LEFT/RIGHT - move between lanes
                    </Text>
                    <Text
                        position={[0, 1, 0.1]}
                        color="#88ccff"
                        fontSize={0.4}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Run off edge of floor to transfer to a wall
                    </Text>
                    <Text
                        position={[0, 0, 0.1]}
                        color="white"
                        fontSize={0.4}
                        anchorX="center"
                        anchorY="middle"
                    >
                        On walls, LEFT/RIGHT still moves between lanes!
                    </Text>
                    <Text
                        position={[0, -1, 0.1]}
                        color="white"
                        fontSize={0.4}
                        anchorX="center"
                        anchorY="middle"
                    >
                        SPACE - jump (away from surface)
                    </Text>
                    <Text
                        position={[0, -2, 0.1]}
                        color="#ff8888"
                        fontSize={0.4}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Avoid falling through the gaps!
                    </Text>
                </group>
            )}

            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <pointLight position={[0, 0, 2]} intensity={0.8} color="#ffffff" />
            <pointLight position={[0, -1.5, 0]} intensity={0.8} color="#ff6666" distance={3} />
            <pointLight position={[2, 0, -10]} intensity={0.5} color="#0066ff" distance={15} />
            <pointLight position={[-2, 0, -20]} intensity={0.5} color="#6600ff" distance={15} />
        </>
    );
}