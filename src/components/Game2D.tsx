import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Stars } from '@react-three/drei';
import { Vector3, Mesh, Group, DoubleSide } from 'three';

// Game configuration
const MOVE_SPEED = 6; // Speed the character runs forward
const SIDE_SPEED = 8; // Speed of side movement
const JUMP_FORCE = 10;
const GRAVITY = 25;
const TUNNEL_SIZE = 5; // Size of tunnel
const TILE_SIZE = 1; // Size of floor/wall tiles
const TUNNEL_LENGTH = 150; // Longer tunnel
const BALL_RADIUS = 0.25; // Character size
const FLOOR_COLORS = ["#1a3784", "#234090", "#2a499c", "#234090", "#1a3784"]; // Alternating colors
const CEILING_COLOR = "#4371c6"; // Lighter blue for ceiling
const WALL_COLOR = "#365bb5"; // Medium blue for walls

// Lane positions
const getLanePosition = (lane: number, totalLanes: number = 5) => {
    const laneWidth = TUNNEL_SIZE / totalLanes;
    return -TUNNEL_SIZE / 2 + laneWidth / 2 + lane * laneWidth;
};

// Define tile type
type Tile = {
    position: [number, number, number]; // x, y, z
    size: [number, number]; // width, length
    type: 'floor' | 'ceiling' | 'leftWall' | 'rightWall';
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

    // Player state
    const playerRef = useRef<Mesh>(null);
    const playerVelocity = useRef(new Vector3(0, 0, 0));
    const isJumping = useRef(false);
    const isMoving = useRef(false);
    const targetX = useRef(getLanePosition(2));

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
            // Calculate difficulty based on distance (more gaps as player progresses)
            // Start with easy difficulty and gradually increase
            const difficulty = Math.min(0.7, 0.2 + (z / length) * 0.5);

            // Create a row of floor tiles
            for (let x = 0; x < totalLanes; x++) {
                // Create a pattern of missing floor tiles to make visible gaps
                let tileExists = true;

                // Safe zone at start
                if (z > 15) {
                    // Increase gap frequency based on distance
                    if (z % 5 === 0) {
                        // Alternating gaps every 5th row
                        tileExists = x % 2 !== 0;
                    }
                    else if (z % 12 === 0) {
                        // Only keep middle tile every 12th row
                        tileExists = x === 2;
                    }
                    // Random gaps based on difficulty
                    else if (z > 30 && Math.random() < difficulty) {
                        tileExists = false;
                    }

                    // Special patterns at significant milestones
                    if (z % 50 === 0 && z > 50) {
                        // Create a zigzag pattern for challenge
                        tileExists = (x + z / 10) % 2 === 0;
                    }

                    // After z > 100, add more challenging patterns
                    if (z > 100 && z % 20 === 0) {
                        // Only leave edge tiles
                        tileExists = (x === 0 || x === 4);
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

    // Check if player is on a tile
    const isPlayerOnTile = () => {
        if (!playerRef.current) return false;

        const playerPos = playerRef.current.position;

        // Check if player is at floor level or above
        const floorY = -TUNNEL_SIZE / 2 + BALL_RADIUS;
        const isAtFloorLevel = playerPos.y >= floorY - 0.1;

        // If already falling below the floor level, don't check for floor tiles
        if (!isAtFloorLevel) return false;

        // Check tiles under player
        const floorTile = tunnelTiles.find(tile =>
            tile.type === 'floor' &&
            Math.abs(tile.position[0] - playerPos.x) < TILE_SIZE / 2 &&
            Math.abs(tile.position[2] + tunnelPosition.current - playerPos.z) < TILE_SIZE / 2
        );

        // Return true if there's a tile and it exists (not a gap)
        return floorTile !== undefined && floorTile.exists;
    };

    // Set up controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameState === 'start') {
                setGameState('playing');
                return;
            }

            if (gameState !== 'playing') return;

            // Don't handle left/right when already moving
            if (isMoving.current && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                e.key === 'a' || e.key === 'd')) return;

            // Move left
            if ((e.key === 'ArrowLeft' || e.key === 'a') && currentLane > 0) {
                const newLane = currentLane - 1;
                setCurrentLane(newLane);
                targetX.current = getLanePosition(newLane);
                isMoving.current = true;
            }

            // Move right
            if ((e.key === 'ArrowRight' || e.key === 'd') && currentLane < 4) {
                const newLane = currentLane + 1;
                setCurrentLane(newLane);
                targetX.current = getLanePosition(newLane);
                isMoving.current = true;
            }

            // Jump
            if (e.key === ' ' && !isJumping.current) {
                isJumping.current = true;
                playerVelocity.current.y = JUMP_FORCE;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            // Restart game
            if (e.key === 'r' && gameState === 'gameOver') {
                // Reset game state
                setGameState('playing');
                setScore(0);
                setCurrentLane(2);
                targetX.current = getLanePosition(2);
                tunnelPosition.current = 0;

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
    }, [currentLane, gameState]);

    // Main game loop
    useFrame((state, delta) => {
        if (gameState === 'gameOver') return;

        if (gameState === 'playing' && playerRef.current) {
            const playerPos = playerRef.current.position;

            // Auto-move forward
            tunnelPosition.current += MOVE_SPEED * delta;

            // Update score
            setScore(Math.floor(tunnelPosition.current));

            // Handle side movement
            if (isMoving.current) {
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
            }

            // Apply gravity
            playerVelocity.current.y -= GRAVITY * delta;

            // Update vertical position
            playerPos.y += playerVelocity.current.y * delta;

            // Get the floor level for collision
            const floorY = -TUNNEL_SIZE / 2 + BALL_RADIUS;

            // Check if player is over a tile and at or above floor level
            const isFalling = playerPos.y < floorY - 0.1;
            const onTile = isPlayerOnTile();

            // If on a solid tile and not already falling through a gap
            if (playerPos.y <= floorY && onTile && !isFalling) {
                // Standing on a solid tile - stop falling
                playerPos.y = floorY;
                playerVelocity.current.y = 0;
                isJumping.current = false;
            }
            // If not on a tile or already falling, keep falling

            // Check if player fell too far
            if (playerPos.y < -TUNNEL_SIZE * 2) {
                setGameState('gameOver');
            }

            // Move player through tunnel
            if (tunnelRef.current) {
                tunnelRef.current.position.z = tunnelPosition.current;
            }
        }

        // Keep camera fixed
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

                    return (
                        <mesh
                            key={`tile-${tile.type}-${index}`}
                            position={tile.position}
                            rotation={rotation as [number, number, number]}
                        >
                            <planeGeometry args={tile.size} />
                            <meshStandardMaterial
                                color={tile.color}
                                side={DoubleSide}
                                emissive={tile.color}
                                emissiveIntensity={0.2}
                            />
                        </mesh>
                    );
                })}
            </group>

            {/* Instructions */}
            {gameState === 'playing' && score < 10 && (
                <group position={[0, 0, -15]}>
                    <mesh position={[0, 0, 0]}>
                        <planeGeometry args={[10, 5]} />
                        <meshBasicMaterial color="#000033" opacity={0.8} transparent={true} />
                    </mesh>
                    <Text
                        position={[0, 1, 0.1]}
                        color="white"
                        fontSize={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Use LEFT / RIGHT arrows to switch lanes
                    </Text>
                    <Text
                        position={[0, 0, 0.1]}
                        color="white"
                        fontSize={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Press SPACE to jump
                    </Text>
                    <Text
                        position={[0, -1, 0.1]}
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