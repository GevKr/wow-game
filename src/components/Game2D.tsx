import { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Stars } from '@react-three/drei';
import { Vector3, Mesh, Group, DoubleSide, Euler, Matrix4 } from 'three';
import { useGameControls, Surface, GameState } from '../hooks/useGameControls';

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

    // Use our game controls hook
    const { getGravityDirection } = useGameControls({
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
        tunnelPosition,

        // Game state
        currentSurface,
        setCurrentSurface,
        currentLane,
        setCurrentLane,
        gameState,
        setGameState,
        setIsFallingThroughGap,
        isFallingThroughGap,
        setScore,

        // Constants
        JUMP_FORCE,
        TUNNEL_SIZE,
        BALL_RADIUS,
        LANE_COUNT,

        // Helper functions
        getLanePosition,
    });

    // Generate tunnel tiles with explicit gaps
    const generateTunnel = () => {
        const tiles: Tile[] = [];
        const totalLanes = 5;
        const length = TUNNEL_LENGTH;

        // Create unique difficulty seeds for each surface
        // These create offset patterns to avoid symmetry
        const surfaceSeeds = {
            floor: Math.random() * 1000,
            ceiling: Math.random() * 1000,
            leftWall: Math.random() * 1000,
            rightWall: Math.random() * 1000
        };

        // Generate tiles for the tunnel
        for (let z = 0; z < length; z++) {
            // Base difficulty values for this segment
            let baseDifficulty = 0;

            // Surface-specific difficulty modifiers (reduced to make fewer gaps)
            const difficultyModifiers = {
                floor: 0.7, // Reduced from 1.0 for fewer gaps
                ceiling: 0.5 + Math.sin(z * 0.1 + surfaceSeeds.ceiling) * 0.15, // Varies between 0.35-0.65
                leftWall: 0.45 + Math.cos(z * 0.08 + surfaceSeeds.leftWall) * 0.15, // Varies between 0.3-0.6
                rightWall: 0.55 + Math.sin(z * 0.12 + surfaceSeeds.rightWall) * 0.1 // Varies between 0.45-0.65
            };

            // Safe zone at the start
            if (z < 15) {
                baseDifficulty = 0; // No gaps
            }
            // Intro phase - very few gaps
            else if (z < 40) {
                baseDifficulty = 0.15; // Reduced from 0.2
            }
            // Medium sections with varying difficulty
            else {
                // Create wave patterns of difficulty that cycle
                const cyclePosition = z % 50; // Difficulty cycles every 50 units

                if (cyclePosition < 15) {
                    // Easier section at beginning of cycle
                    baseDifficulty = 0.15; // Reduced from 0.2
                } else if (cyclePosition < 35) {
                    // Hard section in middle of cycle
                    baseDifficulty = 0.35; // Reduced from 0.5
                } else {
                    // Medium section at end of cycle
                    baseDifficulty = 0.25; // Reduced from 0.35
                }

                // Random difficulty spikes (less frequent and intense)
                if (z > 80 && Math.random() < 0.03) { // Reduced from 0.05
                    // Spike difficulty but less than before
                    baseDifficulty = 0.5; // Reduced from 0.7
                }
            }

            // Calculate surface-specific difficulties
            const surfaceDifficulty = {
                floor: baseDifficulty * difficultyModifiers.floor,
                ceiling: baseDifficulty * difficultyModifiers.ceiling,
                leftWall: baseDifficulty * difficultyModifiers.leftWall,
                rightWall: baseDifficulty * difficultyModifiers.rightWall
            };

            // Helper function to determine if tile should exist based on position and difficulty
            const shouldTileExist = (surface: Surface, x: number, z: number) => {
                // Safe zone at the start
                if (z < 15) return true;

                // Get the appropriate difficulty for this surface
                const difficulty = surfaceDifficulty[surface];

                // Surface-specific offset to avoid symmetry
                const offset = surfaceSeeds[surface] % 10;

                // Pattern-based gaps - but with higher chance of tiles existing
                if (z % 5 === 0) {
                    // Every 5th row has alternating tiles but with more tiles intact
                    // Original: return (x + Math.floor(offset)) % 2 !== 0;
                    // For floor, keep original pattern
                    if (surface === 'floor') {
                        return (x + Math.floor(offset)) % 2 !== 0;
                    }
                    // For other surfaces, allow more tiles to exist
                    return (x + Math.floor(offset)) % 3 !== 0; // Only 1/3 of tiles are gaps
                }
                else if (z % 15 === 0) {
                    // Every 15th row has special patterns with more forgiving gaps
                    if (surface === 'floor') return x === 2 || x === 1 || x === 3; // Three lanes
                    if (surface === 'ceiling') return x === 1 || x === 3 || x === 0; // Three lanes
                    if (surface === 'leftWall') return x === 0 || x === 4 || x === 2; // Three lanes
                    if (surface === 'rightWall') return x % 2 === 0 || x === 1; // Three lanes
                }

                // Special challenge patterns - with increased survival rate
                if (z % 40 === 0 && z > 50) {
                    // More forgiving patterns
                    if (surface === 'floor') {
                        // Floor: modified zigzag with more tiles
                        return (x + Math.floor(z / 10)) % 3 !== 1; // 2/3 of tiles exist
                    } else if (surface === 'ceiling') {
                        // Ceiling: modified checker with more tiles
                        return (x + Math.floor(z / 10) + 1) % 3 !== 0; // 2/3 of tiles exist
                    } else {
                        // Walls: more forgiving alternating pattern
                        return (x + Math.floor(offset + z / 5)) % 3 !== 2; // 2/3 of tiles exist
                    }
                }
                else if (z % 75 === 0 && z > 75) {
                    // More forgiving edge patterns
                    if (surface === 'floor') return x === 0 || x === 4 || x === 2; // Add middle lane
                    if (surface === 'ceiling') return x === 2 || x === 1; // Two lanes
                    if (surface === 'leftWall') return x === 1 || x === 3 || x === 2; // Three lanes
                    if (surface === 'rightWall') return x % 2 === 0 || x === 1; // Three lanes
                }

                // Apply noise to create more natural patterns, but with increased chance of tiles existing
                const noiseValue = Math.sin(x * 0.5 + z * 0.3 + surfaceSeeds[surface]) * 0.3 + 0.7; // Adjusted from *0.5+0.5 to *0.3+0.7

                // Random gaps based on difficulty plus noise, with increased threshold for gaps
                return Math.random() * noiseValue >= difficulty * 0.8; // Reduced actual difficulty by 20%
            };

            // Create a row of floor tiles
            for (let x = 0; x < totalLanes; x++) {
                // Create floor tiles with gaps
                let floorTileExists = shouldTileExist('floor', x, z);

                // Ensure there's always at least one safe path on the floor
                const existingGapsInRow = tiles.filter(t =>
                    t.type === 'floor' &&
                    t.position[2] === -z &&
                    !t.exists
                ).length;

                // More forgiving floor - ensure at least 2 floor tiles exist per row
                if (!floorTileExists && existingGapsInRow >= totalLanes - 2) {
                    floorTileExists = true;
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
                    color: floorTileExists ? FLOOR_COLORS[x] : 'black',
                    exists: floorTileExists
                });

                // Ceiling tile (with possible gaps)
                const ceilingTileExists = shouldTileExist('ceiling', x, z);
                tiles.push({
                    position: [
                        getLanePosition(x, totalLanes),
                        TUNNEL_SIZE / 2, // Top
                        -z
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.9, TILE_SIZE * 0.9] as [number, number],
                    type: 'ceiling',
                    color: ceilingTileExists ? CEILING_COLOR : 'black',
                    exists: ceilingTileExists
                });
            }

            // Left and right wall tiles (with possible gaps)
            for (let y = 0; y < totalLanes; y++) {
                // Left wall
                const leftWallTileExists = shouldTileExist('leftWall', y, z);
                tiles.push({
                    position: [
                        -TUNNEL_SIZE / 2, // Left side
                        getLanePosition(y, totalLanes),
                        -z
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.9, TILE_SIZE * 0.9] as [number, number],
                    type: 'leftWall',
                    color: leftWallTileExists ? WALL_COLOR : 'black',
                    exists: leftWallTileExists
                });

                // Right wall
                const rightWallTileExists = shouldTileExist('rightWall', y, z);
                tiles.push({
                    position: [
                        TUNNEL_SIZE / 2, // Right side
                        getLanePosition(y, totalLanes),
                        -z
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.9, TILE_SIZE * 0.9] as [number, number],
                    type: 'rightWall',
                    color: rightWallTileExists ? WALL_COLOR : 'black',
                    exists: rightWallTileExists
                });
            }
        }

        return tiles;
    };

    // Create tunnel segments
    const tunnelTiles = useMemo(() => {
        return generateTunnel();
    }, []);

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

    // Main game loop
    useFrame((_, delta) => {
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

            // Check for gap detection
            const onSurface = isPlayerOnTile();

            // If we're near the surface but over a gap, mark as falling through
            const nearSurface = (
                (currentSurface === 'floor' || currentSurface === 'ceiling') &&
                Math.abs(playerPos.y - (currentSurface === 'floor' ?
                    -TUNNEL_SIZE / 2 + BALL_RADIUS :
                    TUNNEL_SIZE / 2 - BALL_RADIUS)) < 0.2
            ) || (
                    (currentSurface === 'leftWall' || currentSurface === 'rightWall') &&
                    Math.abs(playerPos.x - (currentSurface === 'leftWall' ?
                        -TUNNEL_SIZE / 2 + BALL_RADIUS :
                        TUNNEL_SIZE / 2 - BALL_RADIUS)) < 0.2
                );

            if (!onSurface && nearSurface && !isFallingThroughGap) {
                setIsFallingThroughGap(true);
                console.log("Falling through gap");
            }

            // Handle side movement (X axis for floor, Y axis for walls) - animated smoothly
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

            // Check if we've recovered from a fall
            if (isFallingThroughGap && onSurface) {
                setIsFallingThroughGap(false);
                console.log("Recovered from fall");
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