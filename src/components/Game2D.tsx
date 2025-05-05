import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Vector3, Mesh, Group } from 'three';

// Game configuration
const MOVE_SPEED = 5;
const SIDE_SPEED = 4;
const TUNNEL_SIZE = 5;
const OBSTACLE_COUNT = 30; // Number of obstacles to generate
const BALL_RADIUS = TUNNEL_SIZE / 10; // 1/5 of tunnel width

// Create a type for our obstacles
type Obstacle = {
    position: [number, number, number];
    size: [number, number, number];
    color: string;
};

export function Game2D() {
    const { camera } = useThree();
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);

    // Player state
    const ballRef = useRef<Mesh>(null);
    const ballPosition = useRef(new Vector3(0, 0, 0));

    // Tunnel state
    const tunnelRef = useRef<Group>(null);

    // Control state
    const keys = useRef({
        left: false,
        right: false,
    });

    // Generate random obstacles
    const obstacles = useMemo(() => {
        const result: Obstacle[] = [];

        for (let i = 0; i < OBSTACLE_COUNT; i++) {
            // Place obstacles deeper in the tunnel to give player time to start
            const zPosition = -30 - i * 15;

            // Random position within the tunnel
            const xPosition = Math.random() * (TUNNEL_SIZE - 2) - (TUNNEL_SIZE / 2 - 1);

            // Random size between 1/5 and 4/5 of tunnel width
            const minSize = TUNNEL_SIZE / 5; // 1/5 of tunnel width
            const maxSize = TUNNEL_SIZE * 4 / 5; // 4/5 of tunnel width
            const width = minSize + Math.random() * (maxSize - minSize);
            const height = minSize + Math.random() * (maxSize - minSize);

            // Random color
            const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            result.push({
                position: [xPosition, -1.5, zPosition],
                size: [width, height, 0.5],
                color
            });
        }

        return result;
    }, []);

    // Check for collisions with obstacles
    const checkCollisions = () => {
        if (!ballRef.current) return;

        const ballPos = ballRef.current.position;

        // Check each obstacle
        for (const obstacle of obstacles) {
            const obstaclePos = new Vector3(...obstacle.position);
            const [width, height, depth] = obstacle.size;

            // Simple collision check based on distance
            const xDist = Math.abs(ballPos.x - obstaclePos.x);
            const yDist = Math.abs(ballPos.y - obstaclePos.y);
            const zDist = Math.abs(ballPos.z - (obstaclePos.z + (tunnelRef.current?.position.z || 0)));

            if (xDist < (width / 2 + BALL_RADIUS) &&
                yDist < (height / 2 + BALL_RADIUS) &&
                zDist < (depth / 2 + BALL_RADIUS)) {
                // Collision detected
                setGameOver(true);
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
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = false;

            // Restart the game with space bar
            if (e.key === ' ' && gameOver) {
                setGameOver(false);
                setScore(0);
                if (tunnelRef.current) tunnelRef.current.position.z = 0;
                if (ballRef.current) ballRef.current.position.x = 0;
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

            // Limit ball movement to tunnel boundaries
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

    return (
        <>
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
                        Press SPACE to restart
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
                        {/* Floor */}
                        <mesh position={[0, -TUNNEL_SIZE / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 10]} />
                            <meshStandardMaterial color="#444444" side={2} />
                        </mesh>

                        {/* Ceiling */}
                        <mesh position={[0, TUNNEL_SIZE / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 10]} />
                            <meshStandardMaterial color="#444444" side={2} />
                        </mesh>

                        {/* Left wall */}
                        <mesh position={[-TUNNEL_SIZE / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 10]} />
                            <meshStandardMaterial color="#555555" side={2} />
                        </mesh>

                        {/* Right wall */}
                        <mesh position={[TUNNEL_SIZE / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 10]} />
                            <meshStandardMaterial color="#555555" side={2} />
                        </mesh>

                        {/* Add markers every 10 units to show movement */}
                        <mesh position={[0, -TUNNEL_SIZE / 2 + 0.01, -5]} rotation={[Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[TUNNEL_SIZE, 0.5]} />
                            <meshBasicMaterial color="#888888" />
                        </mesh>
                    </group>
                ))}

                {/* Add obstacles */}
                {obstacles.map((obstacle, index) => (
                    <mesh
                        key={`obstacle-${index}`}
                        position={obstacle.position}
                    >
                        <boxGeometry args={obstacle.size} />
                        <meshStandardMaterial
                            color={obstacle.color}
                            emissive={obstacle.color}
                            emissiveIntensity={0.3}
                        />
                    </mesh>
                ))}
            </group>

            {/* Instructions */}
            {!gameOver && score < 10 && (
                <group position={[0, 0, -15]}>
                    <mesh position={[0, 0, 0]}>
                        <planeGeometry args={[10, 3]} />
                        <meshBasicMaterial color="#000000" opacity={0.7} transparent={true} />
                    </mesh>
                    <Text
                        position={[0, 0.5, 0.1]}
                        color="white"
                        fontSize={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        Use LEFT / RIGHT arrows
                    </Text>
                    <Text
                        position={[0, -0.5, 0.1]}
                        color="white"
                        fontSize={0.5}
                        anchorX="center"
                        anchorY="middle"
                    >
                        to move the ball
                    </Text>
                </group>
            )}

            {/* Lighting */}
            <ambientLight intensity={0.7} />
            <pointLight position={[0, 0, 2]} intensity={1} />

            {/* Add a light that follows the ball to make it more visible */}
            <pointLight position={[0, -1.5, 0]} intensity={0.8} color="#ff6666" distance={3} />
        </>
    );
}