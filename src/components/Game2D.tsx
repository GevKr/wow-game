import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Stars } from '@react-three/drei';
import { Vector3, Mesh, Group } from 'three';

// Game configuration
const MOVE_SPEED = 5;
const SIDE_SPEED = 4;
const JUMP_FORCE = 8;
const GRAVITY = 15;
const TUNNEL_SIZE = 5;
const HOLE_COUNT = 20; // Number of holes to generate
const BALL_RADIUS = TUNNEL_SIZE / 10; // 1/5 of tunnel width

// Tunnel colors
const FLOOR_COLOR = "#2a4494"; // Deeper blue for floor
const CEILING_COLOR = "#4371c6"; // Lighter blue for ceiling
const WALL_COLOR = "#365bb5"; // Medium blue for walls
const HOLE_COLOR = "#000033"; // Deep blue/black for holes

// Create a type for our holes
type Hole = {
    position: [number, number, number];
    size: [number, number];
};

export function Game2D() {
    const { camera } = useThree();
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);

    // Player state
    const ballRef = useRef<Mesh>(null);
    const ballPosition = useRef(new Vector3(0, 0, 0));
    const ballVelocity = useRef(new Vector3(0, 0, 0));
    const isJumping = useRef(false);

    // Tunnel state
    const tunnelRef = useRef<Group>(null);

    // Control state
    const keys = useRef({
        left: false,
        right: false,
        jump: false
    });

    // Generate random holes in the floor
    const holes = useMemo(() => {
        const result: Hole[] = [];

        for (let i = 0; i < HOLE_COUNT; i++) {
            // Place holes deeper in the tunnel to give player time to start
            const zPosition = -30 - i * 20;

            // Random position within the tunnel width (center-aligned)
            const xPosition = Math.random() * (TUNNEL_SIZE * 0.8) - (TUNNEL_SIZE * 0.4);

            // Random size between 1/5 and 3/5 of tunnel width
            const minSize = TUNNEL_SIZE / 5;
            const maxSize = TUNNEL_SIZE * 3 / 5;
            const width = minSize + Math.random() * (maxSize - minSize);
            const length = 1 + Math.random() * 2; // Length of hole (in z direction)

            result.push({
                position: [xPosition, -TUNNEL_SIZE / 2, zPosition],
                size: [width, length]
            });
        }

        return result;
    }, []);

    // Check for collisions with holes
    const checkCollisions = () => {
        if (!ballRef.current || !tunnelRef.current) return;

        const ballPos = ballRef.current.position;

        // If ball is currently jumping, it can't fall through holes
        if (isJumping.current && ballVelocity.current.y > 0) return;

        // Ball's bottom point (considering radius)
        const ballBottom = ballPos.y - BALL_RADIUS;

        // Only check for hole collisions if the ball is near the floor
        if (Math.abs(ballBottom - (-TUNNEL_SIZE / 2)) > 0.2) return;

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

            if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = true;

            // Jump with space (but only if on the ground)
            if (e.key === ' ' && !isJumping.current) {
                keys.current.jump = true;
                isJumping.current = true;
                ballVelocity.current.y = JUMP_FORCE;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = false;
            if (e.key === ' ') keys.current.jump = false;

            // Restart the game with R key
            if (e.key === 'r' && gameOver) {
                setGameOver(false);
                setScore(0);
                isJumping.current = false;
                ballVelocity.current.set(0, 0, 0);
                if (tunnelRef.current) tunnelRef.current.position.z = 0;
                if (ballRef.current) {
                    ballRef.current.position.x = 0;
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
    }, [gameOver]);

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
            // Move ball left/right
            if (keys.current.left) {
                ballRef.current.position.x -= SIDE_SPEED * delta;
            }
            if (keys.current.right) {
                ballRef.current.position.x += SIDE_SPEED * delta;
            }

            // Handle jumping and gravity
            ballRef.current.position.y += ballVelocity.current.y * delta;

            // Apply gravity if jumping
            if (isJumping.current) {
                ballVelocity.current.y -= GRAVITY * delta;
            }

            // Check floor collision (except when over holes)
            const floorY = -TUNNEL_SIZE / 2 + BALL_RADIUS;
            if (ballRef.current.position.y < floorY && !isOverHole()) {
                ballRef.current.position.y = floorY;
                ballVelocity.current.y = 0;
                isJumping.current = false;
            }

            // Check if ball fell out of the bottom
            if (ballRef.current.position.y < -TUNNEL_SIZE) {
                setGameOver(true);
            }

            // Limit ball movement to tunnel boundaries on X-axis
            const ballBoundary = TUNNEL_SIZE / 2 - BALL_RADIUS;
            if (ballRef.current.position.x < -ballBoundary) {
                ballRef.current.position.x = -ballBoundary;
            }
            if (ballRef.current.position.x > ballBoundary) {
                ballRef.current.position.x = ballBoundary;
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
            <mesh ref={ballRef} position={[0, -1.5, 0]}>
                <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
                <meshStandardMaterial color="#ff3030" emissive="#ff0000" emissiveIntensity={0.3} />
            </mesh>

            {/* Square tunnel */}
            <group ref={tunnelRef}>
                {/* Generate tunnel segments */}
                {Array.from({ length: 50 }).map((_, i) => (
                    <group key={i} position={[0, 0, -i * 10]}>
                        {/* Floor - now with continuous segments to handle holes */}
                        <mesh position={[0, -TUNNEL_SIZE / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 10]} />
                            <meshStandardMaterial color={FLOOR_COLOR} side={2} emissive={FLOOR_COLOR} emissiveIntensity={0.2} />
                        </mesh>

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
                        <meshPhongMaterial
                            color={HOLE_COLOR}
                            side={2}
                            opacity={1}
                            emissive="#000011"
                            emissiveIntensity={0.5}
                            shininess={0}
                        />
                    </mesh>
                ))}
            </group>

            {/* Instructions */}
            {!gameOver && score < 10 && (
                <group position={[0, 0, -15]}>
                    <mesh position={[0, 0, 0]}>
                        <planeGeometry args={[10, 4]} />
                        <meshBasicMaterial color="#000033" opacity={0.8} transparent={true} />
                    </mesh>
                    <Text
                        position={[0, 1, 0.1]}
                        color="white"
                        fontSize={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Use LEFT / RIGHT arrows to move
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
                        color="#88ccff"
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