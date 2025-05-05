import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Stars } from '@react-three/drei';
import { Vector3, Mesh, Group } from 'three';

// Game configuration
const MOVE_SPEED = 5;
const LANE_COUNT = 5; // Number of lanes
const JUMP_FORCE = 10; // Increased jump force
const GRAVITY = 25; // Increased gravity for faster fall
const TUNNEL_SIZE = 5;
const HOLE_COUNT = 20; // Number of holes to generate
const BALL_RADIUS = TUNNEL_SIZE / 10; // 1/5 of tunnel width

// Lane positions
const getLanePosition = (lane: number) => {
    const laneWidth = TUNNEL_SIZE / LANE_COUNT;
    return -TUNNEL_SIZE / 2 + laneWidth / 2 + lane * laneWidth;
};

// Tunnel colors
const CEILING_COLOR = "#4371c6"; // Lighter blue for ceiling
const WALL_COLOR = "#365bb5"; // Medium blue for walls
const HOLE_COLOR = "#000033"; // Deep blue/black for holes
const LANE_DIVIDER_COLOR = "#5a8be5"; // Brighter divider color for better visibility
const LANE_COLORS = ["#1a3784", "#234090", "#2a499c", "#234090", "#1a3784"]; // Subtle alternating lane colors

// Create a type for our holes
type Hole = {
    position: [number, number, number];
    size: [number, number];
    lane: number; // The lane this hole is in (0-4)
};

export function Game2D() {
    const { camera } = useThree();
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [currentLane, setCurrentLane] = useState(2); // Start in the middle lane (0-4)

    // Player state
    const ballRef = useRef<Mesh>(null);
    const ballPosition = useRef(new Vector3(getLanePosition(2), 0, 0)); // Start in middle lane
    const ballVelocity = useRef(new Vector3(0, 0, 0));
    const isJumping = useRef(false);
    const jumpCount = useRef(0); // Track number of jumps
    const isMoving = useRef(false);
    const targetX = useRef(getLanePosition(2));

    // Tunnel state
    const tunnelRef = useRef<Group>(null);

    // Generate random holes in the floor
    const holes = useMemo(() => {
        const result: Hole[] = [];

        for (let i = 0; i < HOLE_COUNT; i++) {
            // Place holes deeper in the tunnel to give player time to start
            const zPosition = -30 - i * 20;

            // Randomly select a lane for this hole
            const lane = Math.floor(Math.random() * LANE_COUNT);
            const xPosition = getLanePosition(lane);

            // Random size (but smaller than a lane)
            const laneWidth = TUNNEL_SIZE / LANE_COUNT;
            const holeWidth = laneWidth * 0.8; // 80% of lane width
            const holeLength = 1 + Math.random() * 2; // Length of hole (in z direction)

            result.push({
                position: [xPosition, -TUNNEL_SIZE / 2, zPosition],
                size: [holeWidth, holeLength],
                lane
            });
        }

        return result;
    }, []);

    // Check for collisions with holes
    const checkCollisions = () => {
        if (!ballRef.current || !tunnelRef.current) return;

        const ballPos = ballRef.current.position;

        // If ball is currently jumping and going up, it can't fall through holes
        if (isJumping.current && ballVelocity.current.y > 0) return;

        // Ball's bottom point (considering radius)
        const ballBottom = ballPos.y - BALL_RADIUS;

        // Check if the ball is near the floor
        if (ballBottom > -TUNNEL_SIZE / 2 + 0.3) return;

        // Check each hole
        for (const hole of holes) {
            const holePos = new Vector3(...hole.position);
            const [width, length] = hole.size;

            // Adjust hole position by tunnel position
            holePos.z += tunnelRef.current.position.z;

            // Check if ball is above the hole
            const xDist = Math.abs(ballPos.x - holePos.x);
            const zDist = Math.abs(ballPos.z - holePos.z);

            if (xDist < width / 2 && zDist < length / 2) {
                // Ball is over a hole - make it fall
                ballVelocity.current.y = -GRAVITY;
                isJumping.current = true;

                // Check if the ball has fallen too far
                if (ballPos.y < -TUNNEL_SIZE) {
                    setGameOver(true);
                }

                return;
            }
        }
    };

    // Set up keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameOver) return;

            // Don't handle left/right when already moving
            if (isMoving.current && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                e.key === 'a' || e.key === 'd')) return;

            // Move left (to previous lane)
            if ((e.key === 'ArrowLeft' || e.key === 'a') && currentLane > 0) {
                const newLane = currentLane - 1;
                setCurrentLane(newLane);
                targetX.current = getLanePosition(newLane);
                isMoving.current = true;
            }

            // Move right (to next lane)
            if ((e.key === 'ArrowRight' || e.key === 'd') && currentLane < LANE_COUNT - 1) {
                const newLane = currentLane + 1;
                setCurrentLane(newLane);
                targetX.current = getLanePosition(newLane);
                isMoving.current = true;
            }

            // Jump with space (first or double jump)
            if (e.key === ' ') {
                if (!isJumping.current) {
                    // First jump
                    isJumping.current = true;
                    jumpCount.current = 1;
                    ballVelocity.current.y = JUMP_FORCE;
                } else if (jumpCount.current === 1) {
                    // Double jump
                    jumpCount.current = 2;
                    ballVelocity.current.y = JUMP_FORCE * 0.8; // Slightly less power on second jump
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            // Restart the game with R key
            if (e.key === 'r' && gameOver) {
                setGameOver(false);
                setScore(0);
                setCurrentLane(2);
                targetX.current = getLanePosition(2);
                isJumping.current = false;
                jumpCount.current = 0;
                isMoving.current = false;
                ballVelocity.current.set(0, 0, 0);
                if (tunnelRef.current) tunnelRef.current.position.z = 0;
                if (ballRef.current) {
                    ballRef.current.position.x = getLanePosition(2);
                    ballRef.current.position.y = -1.5;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [currentLane, gameOver]);

    // Main game loop
    useFrame((state, delta) => {
        if (gameOver) return;

        // Move the tunnel backward
        if (tunnelRef.current) {
            tunnelRef.current.position.z += MOVE_SPEED * delta;

            // Update score based on distance
            setScore(Math.floor(tunnelRef.current.position.z));
        }

        // Handle ball movement based on keyboard input
        if (ballRef.current) {
            // Handle lane movement smoothly
            if (isMoving.current) {
                const moveSpeed = 10; // Lanes per second
                const step = moveSpeed * delta;
                const diff = targetX.current - ballRef.current.position.x;

                if (Math.abs(diff) <= step) {
                    // We've reached the target position
                    ballRef.current.position.x = targetX.current;
                    isMoving.current = false;
                } else {
                    // Move toward the target
                    ballRef.current.position.x += Math.sign(diff) * step;
                }
            }

            // Handle jumping and gravity
            ballRef.current.position.y += ballVelocity.current.y * delta;

            // Apply gravity if jumping
            if (isJumping.current) {
                ballVelocity.current.y -= GRAVITY * delta;

                // Create small trail effect while jumping
                if (Math.abs(ballVelocity.current.y) > 2) {
                    // Add trail code here if desired
                }
            }

            // Check floor collision (except when over holes)
            const floorY = -TUNNEL_SIZE / 2 + BALL_RADIUS;
            if (ballRef.current.position.y < floorY && !isOverHole()) {
                ballRef.current.position.y = floorY;
                ballVelocity.current.y = 0;
                isJumping.current = false;
                jumpCount.current = 0; // Reset jump count when landing
            }

            // Check if ball fell out of the bottom
            if (ballRef.current.position.y < -TUNNEL_SIZE) {
                setGameOver(true);
            }

            // Update the ball's position for collision detection
            ballPosition.current.copy(ballRef.current.position);

            // Check for collisions
            checkCollisions();
        }

        // Keep camera fixed relative to the ball
        camera.position.set(0, 0, 5);
        camera.lookAt(0, 0, 0);
    });

    // Check if the ball is over a hole
    const isOverHole = (): boolean => {
        if (!ballRef.current || !tunnelRef.current) return false;

        const ballPos = ballRef.current.position;

        for (const hole of holes) {
            const holePos = new Vector3(...hole.position);
            const [width, length] = hole.size;

            // Adjust hole position by tunnel position
            holePos.z += tunnelRef.current.position.z;

            // Check if ball is above the hole
            const xDist = Math.abs(ballPos.x - holePos.x);
            const zDist = Math.abs(ballPos.z - holePos.z);

            if (xDist < width / 2 && zDist < length / 2) {
                return true;
            }
        }

        return false;
    };

    // Generate lane divider positions
    const laneDividers = useMemo(() => {
        const dividers = [];
        const laneWidth = TUNNEL_SIZE / LANE_COUNT;

        // Create dividers between lanes (not at edges)
        for (let i = 1; i < LANE_COUNT; i++) {
            const xPosition = -TUNNEL_SIZE / 2 + i * laneWidth;
            dividers.push(xPosition);
        }

        return dividers;
    }, []);

    return (
        <>
            {/* Space background with stars */}
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

            {/* Game over message */}
            {gameOver && (
                <>
                    <Text
                        position={[0, 0, 0]}
                        color="red"
                        fontSize={1}
                        anchorX="center"
                        anchorY="middle"
                    >
                        GAME OVER
                    </Text>
                    <Text
                        position={[0, -1, 0]}
                        color="white"
                        fontSize={0.4}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Press R to restart
                    </Text>
                </>
            )}

            {/* Ball */}
            <mesh ref={ballRef} position={[getLanePosition(2), -1.5, 0]}>
                <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
                <meshStandardMaterial color="#ff3030" emissive="#ff0000" emissiveIntensity={0.3} />
            </mesh>

            {/* Square tunnel */}
            <group ref={tunnelRef}>
                {/* Generate tunnel segments */}
                {Array.from({ length: 50 }).map((_, i) => (
                    <group key={i} position={[0, 0, -i * 10]}>
                        {/* Floor with lane colors - replaced the continuous floor */}
                        {Array.from({ length: LANE_COUNT }).map((_, laneIndex) => {
                            const laneWidth = TUNNEL_SIZE / LANE_COUNT;
                            const xPosition = getLanePosition(laneIndex);
                            return (
                                <mesh
                                    key={`lane-${laneIndex}-${i}`}
                                    position={[xPosition, -TUNNEL_SIZE / 2, 0]}
                                    rotation={[Math.PI / 2, 0, 0]}
                                >
                                    <planeGeometry args={[laneWidth * 0.95, 10]} />
                                    <meshStandardMaterial
                                        color={LANE_COLORS[laneIndex]}
                                        side={2}
                                        emissive={LANE_COLORS[laneIndex]}
                                        emissiveIntensity={0.2}
                                    />
                                </mesh>
                            );
                        })}

                        {/* Ceiling */}
                        <mesh position={[0, TUNNEL_SIZE / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 10]} />
                            <meshStandardMaterial color={CEILING_COLOR} side={2} emissive={CEILING_COLOR} emissiveIntensity={0.2} />
                        </mesh>

                        {/* Left wall */}
                        <mesh position={[-TUNNEL_SIZE / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 10]} />
                            <meshStandardMaterial color={WALL_COLOR} side={2} emissive={WALL_COLOR} emissiveIntensity={0.2} />
                        </mesh>

                        {/* Right wall */}
                        <mesh position={[TUNNEL_SIZE / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 10]} />
                            <meshStandardMaterial color={WALL_COLOR} side={2} emissive={WALL_COLOR} emissiveIntensity={0.2} />
                        </mesh>

                        {/* Lane dividers on the floor */}
                        {laneDividers.map((xPos, index) => (
                            Array.from({ length: 10 }).map((_, dashIndex) => (
                                <mesh
                                    key={`divider-${index}-${i}-${dashIndex}`}
                                    position={[
                                        xPos,
                                        -TUNNEL_SIZE / 2 + 0.03,
                                        -dashIndex - (dashIndex * 0.5) // Space them out along the Z axis
                                    ]}
                                    rotation={[0, 0, 0]}
                                >
                                    <boxGeometry args={[0.03, 0.06, 0.3]} />
                                    <meshBasicMaterial
                                        color={LANE_DIVIDER_COLOR}
                                    />
                                </mesh>
                            ))
                        ))}

                        {/* Add glowing grid lines on the floor to highlight edges */}
                        <mesh position={[0, -TUNNEL_SIZE / 2 + 0.01, -5]} rotation={[Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 0.1]} />
                            <meshBasicMaterial color="#88ccff" />
                        </mesh>
                    </group>
                ))}

                {/* Add holes in the floor */}
                {holes.map((hole, index) => (
                    <mesh
                        key={`hole-${index}`}
                        position={[hole.position[0], hole.position[1] - 1, hole.position[2]]}
                    >
                        <boxGeometry args={[hole.size[0], 2, hole.size[1]]} />
                        <meshBasicMaterial
                            color={HOLE_COLOR}
                        />
                    </mesh>
                ))}
            </group>

            {/* Instructions */}
            {!gameOver && score < 10 && (
                <group position={[0, 0, -15]}>
                    <mesh position={[0, 0, 0]}>
                        <planeGeometry args={[10, 5]} />
                        <meshBasicMaterial color="#000033" opacity={0.8} transparent={true} />
                    </mesh>
                    <Text
                        position={[0, 1.5, 0.1]}
                        color="white"
                        fontSize={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Use LEFT / RIGHT arrows to switch lanes
                    </Text>
                    <Text
                        position={[0, 0.5, 0.1]}
                        color="white"
                        fontSize={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Press SPACE to jump
                    </Text>
                    <Text
                        position={[0, -0.5, 0.1]}
                        color="#88ccff"
                        fontSize={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Press SPACE twice for double jump!
                    </Text>
                    <Text
                        position={[0, -1.5, 0.1]}
                        color="#ff8888"
                        fontSize={0.4}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Avoid falling through the holes!
                    </Text>
                </group>
            )}

            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <pointLight position={[0, 0, 2]} intensity={0.8} color="#ffffff" />
            <pointLight position={[0, -1.5, 0]} intensity={0.8} color="#ff6666" distance={3} />

            {/* Add some colored point lights in the tunnel for atmosphere */}
            <pointLight position={[2, 0, -10]} intensity={0.5} color="#0066ff" distance={15} />
            <pointLight position={[-2, 0, -20]} intensity={0.5} color="#6600ff" distance={15} />
        </>
    );
}