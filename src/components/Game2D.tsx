import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Stars } from '@react-three/drei';
import { Vector3, Group, DoubleSide, Euler, Matrix4 } from 'three';
import { useGameControls, Surface, GameState } from '../hooks/useGameControls';
import { updateGlobalScore } from '../App';

// Game configuration
const INITIAL_MOVE_SPEED = 4; // Initial speed the character runs forward
const SPEED_INCREASE = 0.5; // Speed increase per color change
const BOOST_AMOUNT = 3; // Speed boost when pressing up (increased from 2 to 3)
const BOOST_DURATION = 500; // Duration of boost in milliseconds
const SIDE_SPEED = 8; // Speed of side movement
const JUMP_FORCE = 10;
const GRAVITY = 25;
const TUNNEL_SIZE = 5; // Size of tunnel
const TILE_SIZE = 1; // Size of floor/wall tiles
const SEGMENT_LENGTH = 10; // Length of each tunnel segment (reduced to 10)
const VISIBLE_SEGMENTS = 5; // Number of segments to keep visible
const EXTENSION_THRESHOLD = 40; // When to add a new segment (distance from the end)
const BALL_RADIUS = 0.25; // Character size
const COLOR_CHANGE_INTERVAL = 4; // Number of segments before color changes
const TILE_EMISSIVE_INTENSITY = 1.2; // Increased base emissive intensity for brighter glow
const LANE_COUNT = 5; // Number of lanes
const KEY_NOTE_CHANCE = 0.05; // Reduced chance of a key note appearing (from 0.15)
const INVINCIBILITY_DURATION = 3000; // Duration of invincibility in milliseconds
const KEY_NOTE_ROTATION_SPEED = 3; // Increased rotation speed for more sparkle

// Color schemes - bright transition from blue to red
const COLOR_SCHEMES = [
    "#00aaff", // Bright blue
    "#44aaff", // Bright sky blue
    "#7799ff", // Bright blue-purple
    "#aa88ff", // Bright purple
    "#ff66ff", // Bright pink
    "#ff4477", // Bright pink-red
    "#ff3333", // Bright red
];

// Get color based on segment index with interpolation
const getColorForSegment = (segmentIndex: number) => {
    const progress = (segmentIndex / COLOR_CHANGE_INTERVAL) % 1;
    const baseIndex = Math.floor((segmentIndex / COLOR_CHANGE_INTERVAL)) % (COLOR_SCHEMES.length - 1);
    const nextIndex = (baseIndex + 1) % COLOR_SCHEMES.length;

    // Convert hex colors to RGB for interpolation
    const color1 = {
        r: parseInt(COLOR_SCHEMES[baseIndex].slice(1, 3), 16),
        g: parseInt(COLOR_SCHEMES[baseIndex].slice(3, 5), 16),
        b: parseInt(COLOR_SCHEMES[baseIndex].slice(5, 7), 16)
    };

    const color2 = {
        r: parseInt(COLOR_SCHEMES[nextIndex].slice(1, 3), 16),
        g: parseInt(COLOR_SCHEMES[nextIndex].slice(3, 5), 16),
        b: parseInt(COLOR_SCHEMES[nextIndex].slice(5, 7), 16)
    };

    // Linear interpolation between colors with increased brightness
    const r = Math.round(color1.r * (1 - progress) + color2.r * progress);
    const g = Math.round(color1.g * (1 - progress) + color2.g * progress);
    const b = Math.round(color1.b * (1 - progress) + color2.b * progress);

    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

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
    segmentIndex: number; // Which segment this tile belongs to
};

// Define segment type
type TunnelSegment = {
    startZ: number;
    endZ: number;
    tiles: Tile[];
};

// Key note type
type KeyNote = {
    position: [number, number, number];
    collected: boolean;
    segmentIndex: number;
};

export function Game2D() {
    const { camera } = useThree();
    const [score, setScore] = useState(0);
    const [gameState, setGameState] = useState<GameState>('start');
    const [currentLane, setCurrentLane] = useState(2); // Start in middle lane (0-4)
    const [currentSurface, setCurrentSurface] = useState<Surface>('floor');
    const [isFallingThroughGap, setIsFallingThroughGap] = useState(false);
    const isDebugMode = useRef(false);
    const currentSpeed = useRef(INITIAL_MOVE_SPEED);
    const lastColorIndex = useRef(0);
    const isBoostActive = useRef(false);
    const boostTimeout = useRef<NodeJS.Timeout | null>(null);
    const canBoost = useRef(true);
    const [showGameOver, setShowGameOver] = useState(false);

    // Track generated tunnel segments
    const [tunnelSegments, setTunnelSegments] = useState<TunnelSegment[]>([]);
    const nextSegmentZ = useRef(0);
    const generatedSegmentsCount = useRef(0);

    // Player state
    const playerRef = useRef<Group>(null);
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

    // Add motion blur strength state
    const [blurStrength, setBlurStrength] = useState(0);
    const [keyNotes, setKeyNotes] = useState<KeyNote[]>([]);
    const [isInvincible, setIsInvincible] = useState(false);
    const [collectionEffect, setCollectionEffect] = useState<{ position: [number, number, number], time: number } | null>(null);
    const invincibilityTimer = useRef<NodeJS.Timeout | null>(null);
    const invincibilityEffectsRef = useRef<Group>(null);
    const colorTransitionStart = useRef<number | null>(null);
    const COLOR_TRANSITION_DURATION = 1000; // 1 second transition

    // Helper function to lerp colors
    const lerpColor = (start: string, end: string, t: number) => {
        // Convert hex to rgb
        const startRGB = {
            r: parseInt(start.slice(1, 3), 16),
            g: parseInt(start.slice(3, 5), 16),
            b: parseInt(start.slice(5, 7), 16)
        };
        const endRGB = {
            r: parseInt(end.slice(1, 3), 16),
            g: parseInt(end.slice(3, 5), 16),
            b: parseInt(end.slice(5, 7), 16)
        };

        // Lerp each component
        const r = Math.round(startRGB.r + (endRGB.r - startRGB.r) * t);
        const g = Math.round(startRGB.g + (endRGB.g - startRGB.g) * t);
        const b = Math.round(startRGB.b + (endRGB.b - startRGB.b) * t);

        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    // Update blur effect when boost state changes
    useEffect(() => {
        let blurAnimation: number;

        const animateBlur = () => {
            if (isBoostActive.current && blurStrength < 0.5) {
                setBlurStrength(prev => Math.min(prev + 0.1, 0.5));
            } else if (!isBoostActive.current && blurStrength > 0) {
                setBlurStrength(prev => Math.max(prev - 0.1, 0));
            }
            blurAnimation = requestAnimationFrame(animateBlur);
        };

        blurAnimation = requestAnimationFrame(animateBlur);
        return () => cancelAnimationFrame(blurAnimation);
    }, [blurStrength]);

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

    // Add debug mode key handler
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (gameState === 'start' && event.key === '5') {
                isDebugMode.current = true;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [gameState]);

    // Add boost control
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (gameState === 'playing' && event.key === 'ArrowUp' && canBoost.current && !isBoostActive.current) {
                // Activate boost
                isBoostActive.current = true;
                canBoost.current = false;

                // Clear any existing timeout
                if (boostTimeout.current) {
                    clearTimeout(boostTimeout.current);
                }

                // Set timeout to deactivate boost
                boostTimeout.current = setTimeout(() => {
                    isBoostActive.current = false;
                    // Add a small delay before allowing next boost
                    setTimeout(() => {
                        canBoost.current = true;
                    }, 100);
                }, BOOST_DURATION);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (boostTimeout.current) {
                clearTimeout(boostTimeout.current);
            }
        };
    }, [gameState]);

    // Reset boost state when game restarts
    useEffect(() => {
        if (gameState === 'start') {
            isBoostActive.current = false;
            canBoost.current = true;
            if (boostTimeout.current) {
                clearTimeout(boostTimeout.current);
            }
        }
    }, [gameState]);

    // Generate a tunnel segment starting at the given Z position
    const generateTunnelSegment = useCallback((startZ: number): TunnelSegment => {
        const tiles: Tile[] = [];
        const newKeyNotes: KeyNote[] = [];
        const totalLanes = 5;
        const length = SEGMENT_LENGTH;
        const segmentIndex = generatedSegmentsCount.current;

        // Create unique difficulty seeds for each surface
        // These create offset patterns to avoid symmetry
        const surfaceSeeds = {
            floor: Math.random() * 1000 + segmentIndex * 37.5,
            ceiling: Math.random() * 1000 + segmentIndex * 84.3,
            leftWall: Math.random() * 1000 + segmentIndex * 129.7,
            rightWall: Math.random() * 1000 + segmentIndex * 176.2
        };

        // Generate tiles for the tunnel segment
        for (let z = 0; z < length; z++) {
            const absoluteZ = startZ + z;

            // Generate key notes with some probability
            if (Math.random() < KEY_NOTE_CHANCE && segmentIndex > 0) {
                const lane = Math.floor(Math.random() * totalLanes);
                const surface = Math.random() < 0.7 ? 'floor' :
                    Math.random() < 0.5 ? 'leftWall' : 'rightWall';

                let notePosition: [number, number, number];
                switch (surface) {
                    case 'floor':
                        notePosition = [
                            getLanePosition(lane, totalLanes),
                            -TUNNEL_SIZE / 2 + 0.5, // Lowered to be closer to floor
                            -(z + startZ)
                        ];
                        break;
                    case 'leftWall':
                        notePosition = [
                            -TUNNEL_SIZE / 2 + 0.5, // Closer to left wall
                            getLanePosition(lane, totalLanes),
                            -(z + startZ)
                        ];
                        break;
                    default: // rightWall
                        notePosition = [
                            TUNNEL_SIZE / 2 - 0.5, // Closer to right wall
                            getLanePosition(lane, totalLanes),
                            -(z + startZ)
                        ];
                }

                newKeyNotes.push({
                    position: notePosition,
                    collected: false,
                    segmentIndex
                });
            }

            // Base difficulty values for this segment
            let baseDifficulty = 0;

            // Surface-specific difficulty modifiers (reduced to make fewer gaps)
            const difficultyModifiers = {
                floor: 0.5, // Reduced from 0.7
                ceiling: 0.3 + Math.sin(absoluteZ * 0.1 + surfaceSeeds.ceiling) * 0.1, // Reduced from 0.5
                leftWall: 0.25 + Math.cos(absoluteZ * 0.08 + surfaceSeeds.leftWall) * 0.1, // Reduced from 0.45
                rightWall: 0.35 + Math.sin(absoluteZ * 0.12 + surfaceSeeds.rightWall) * 0.1 // Reduced from 0.55
            };

            // Safe zone at the start
            if (segmentIndex === 0 && z < 15) {
                baseDifficulty = 0; // No gaps
            }
            // Intro phase - very few gaps
            else if (segmentIndex === 0 && z < 40) {
                baseDifficulty = 0.1; // Reduced from 0.15
            }
            // Medium sections with varying difficulty
            else {
                // Create wave patterns of difficulty that cycle
                const cyclePosition = absoluteZ % 50; // Difficulty cycles every 50 units

                if (cyclePosition < 20) { // Increased easy section length
                    // Easier section at beginning of cycle
                    baseDifficulty = 0.1; // Reduced from 0.15
                } else if (cyclePosition < 35) {
                    // Hard section in middle of cycle
                    baseDifficulty = 0.25; // Reduced from 0.35
                } else {
                    // Medium section at end of cycle
                    baseDifficulty = 0.15; // Reduced from 0.25
                }

                // Random difficulty spikes (less frequent and less intense)
                if (absoluteZ > 80 && Math.random() < 0.02) { // Reduced from 0.03
                    // Spike difficulty but less than before
                    baseDifficulty = 0.35; // Reduced from 0.5
                }

                // Gradually increase difficulty with distance (slower progression)
                baseDifficulty += segmentIndex * 0.02; // Reduced from 0.03
                baseDifficulty = Math.min(baseDifficulty, 0.5); // Reduced cap from 0.7
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
                if (segmentIndex === 0 && z < 15) return true;

                // Get the appropriate difficulty for this surface
                const difficulty = surfaceDifficulty[surface];

                // Surface-specific offset to avoid symmetry
                const offset = surfaceSeeds[surface] % 10;

                // Pattern-based gaps - but with higher chance of tiles existing
                if (absoluteZ % 5 === 0) {
                    // Every 5th row has alternating tiles but with more tiles intact
                    if (surface === 'floor') {
                        return (x + Math.floor(offset)) % 3 !== 0; // Only 1/3 gaps instead of 1/2
                    }
                    // For other surfaces, allow more tiles to exist
                    return (x + Math.floor(offset)) % 4 !== 0; // Only 1/4 of tiles are gaps
                }
                else if (absoluteZ % 15 === 0) {
                    // Every 15th row has special patterns with more forgiving gaps
                    if (surface === 'floor') return x === 2 || x === 1 || x === 3 || x === 0; // Four lanes
                    if (surface === 'ceiling') return x === 1 || x === 3 || x === 0 || x === 4; // Four lanes
                    if (surface === 'leftWall') return x === 0 || x === 4 || x === 2 || x === 1; // Four lanes
                    if (surface === 'rightWall') return x % 2 === 0 || x === 1 || x === 3; // Four lanes
                }

                // Special challenge patterns - with increased survival rate
                if (absoluteZ % 40 === 0 && absoluteZ > 50) {
                    // More forgiving patterns
                    if (surface === 'floor') {
                        // Floor: modified zigzag with more tiles
                        return (x + Math.floor(absoluteZ / 10)) % 4 !== 1; // 3/4 of tiles exist
                    } else if (surface === 'ceiling') {
                        // Ceiling: modified checker with more tiles
                        return (x + Math.floor(absoluteZ / 10) + 1) % 4 !== 0; // 3/4 of tiles exist
                    } else {
                        // Walls: more forgiving alternating pattern
                        return (x + Math.floor(offset + absoluteZ / 5)) % 4 !== 2; // 3/4 of tiles exist
                    }
                }

                // Apply noise to create more natural patterns, with increased chance of tiles existing
                const noiseValue = Math.sin(x * 0.5 + absoluteZ * 0.3 + surfaceSeeds[surface]) * 0.2 + 0.8; // Adjusted from *0.3+0.7 to *0.2+0.8

                // Random gaps based on difficulty plus noise, with increased threshold for gaps
                return Math.random() * noiseValue >= difficulty * 0.7; // Reduced actual difficulty by 30%
            };

            // Create a row of floor tiles
            for (let x = 0; x < totalLanes; x++) {
                // Create floor tiles with gaps
                let floorTileExists = shouldTileExist('floor', x, z);

                // Ensure there's always at least one safe path on the floor
                const existingGapsInRow = tiles.filter(t =>
                    t.type === 'floor' &&
                    t.position[2] === -z - startZ &&
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
                        -(z + startZ)
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.95, TILE_SIZE * 0.95] as [number, number], // Slightly smaller tiles for gap effect
                    type: 'floor',
                    color: getColorForSegment(segmentIndex),
                    exists: floorTileExists,
                    segmentIndex
                });

                // Ceiling tile (with possible gaps)
                const ceilingTileExists = shouldTileExist('ceiling', x, z);
                tiles.push({
                    position: [
                        getLanePosition(x, totalLanes),
                        TUNNEL_SIZE / 2, // Top
                        -(z + startZ)
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.95, TILE_SIZE * 0.95] as [number, number],
                    type: 'ceiling',
                    color: getColorForSegment(segmentIndex),
                    exists: ceilingTileExists,
                    segmentIndex
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
                        -(z + startZ)
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.95, TILE_SIZE * 0.95] as [number, number],
                    type: 'leftWall',
                    color: getColorForSegment(segmentIndex),
                    exists: leftWallTileExists,
                    segmentIndex
                });

                // Right wall
                const rightWallTileExists = shouldTileExist('rightWall', y, z);
                tiles.push({
                    position: [
                        TUNNEL_SIZE / 2, // Right side
                        getLanePosition(y, totalLanes),
                        -(z + startZ)
                    ] as [number, number, number],
                    size: [TILE_SIZE * 0.95, TILE_SIZE * 0.95] as [number, number],
                    type: 'rightWall',
                    color: getColorForSegment(segmentIndex),
                    exists: rightWallTileExists,
                    segmentIndex
                });
            }
        }

        // Add the new key notes to the state
        setKeyNotes(prev => [...prev, ...newKeyNotes]);

        generatedSegmentsCount.current++;
        return {
            startZ,
            endZ: startZ + length,
            tiles
        };
    }, []);

    // Initialize tunnel segments on first render
    useMemo(() => {
        const initialSegments: TunnelSegment[] = [];
        for (let i = 0; i < VISIBLE_SEGMENTS; i++) {
            const segment = generateTunnelSegment(i * SEGMENT_LENGTH);
            initialSegments.push(segment);
            nextSegmentZ.current = (i + 1) * SEGMENT_LENGTH;
        }
        setTunnelSegments(initialSegments);
    }, [generateTunnelSegment]);

    // Modify isPlayerOnTile to respect debug mode and invincibility
    const isPlayerOnTile = () => {
        if (!playerRef.current) return false;

        // If in debug mode or invincible, always return true
        if (isDebugMode.current || isInvincible) return true;

        // If falling through a gap, keep falling
        if (isFallingThroughGap) return false;

        const playerPos = playerRef.current.position;
        const posZ = tunnelPosition.current;

        // Find appropriate tile based on current surface
        let tile;

        // Get all tiles from all segments, filtered by surface
        const allTilesOfCurrentSurface = tunnelSegments.flatMap(segment =>
            segment.tiles.filter(t => t.type === currentSurface)
        );

        switch (currentSurface) {
            case 'floor':
                tile = allTilesOfCurrentSurface.find(t =>
                    Math.abs(t.position[0] - playerPos.x) < TILE_SIZE / 2 &&
                    Math.abs(t.position[2] + posZ - playerPos.z) < TILE_SIZE / 2
                );
                break;

            case 'ceiling':
                tile = allTilesOfCurrentSurface.find(t =>
                    Math.abs(t.position[0] - playerPos.x) < TILE_SIZE / 2 &&
                    Math.abs(t.position[2] + posZ - playerPos.z) < TILE_SIZE / 2
                );
                break;

            case 'leftWall':
                tile = allTilesOfCurrentSurface.find(t =>
                    Math.abs(t.position[1] - playerPos.y) < TILE_SIZE / 2 &&
                    Math.abs(t.position[2] + posZ - playerPos.z) < TILE_SIZE / 2
                );
                break;

            case 'rightWall':
                tile = allTilesOfCurrentSurface.find(t =>
                    Math.abs(t.position[1] - playerPos.y) < TILE_SIZE / 2 &&
                    Math.abs(t.position[2] + posZ - playerPos.z) < TILE_SIZE / 2
                );
                break;
        }

        // Return true if there's a tile and it exists (not a gap)
        return tile !== undefined && tile.exists;
    };

    // Check if we need to add a new segment and remove old ones
    const checkAndAddSegment = () => {
        const playerZ = tunnelPosition.current;
        const lastSegment = tunnelSegments[tunnelSegments.length - 1];

        // If player is approaching the end of the last segment
        if (lastSegment && playerZ > lastSegment.endZ - EXTENSION_THRESHOLD) {
            // Generate and add a new segment
            const newSegment = generateTunnelSegment(nextSegmentZ.current);
            nextSegmentZ.current += SEGMENT_LENGTH;

            // Remove old segments that are too far behind the player
            setTunnelSegments(prevSegments => {
                const newSegments = [...prevSegments, newSegment];
                // Keep only segments that are within the visible range
                return newSegments.filter(segment =>
                    segment.endZ > playerZ - (SEGMENT_LENGTH * 2)
                );
            });
        }
    };

    // Main game loop
    useFrame((_, delta) => {
        if (gameState === 'gameOver') return;

        if (gameState === 'playing' && playerRef.current) {
            const playerPos = playerRef.current.position;
            const gravityDir = getGravityDirection();

            // Handle color transition
            let currentColor = "#ff3030";
            let currentEmissive = "#ff0000";
            let currentEmissiveIntensity = 0.3;
            let currentMetalness = 0.5;
            let currentRoughness = 0.5;

            if (isInvincible) {
                currentColor = "#ffffff";
                currentEmissive = "#ffffff";
                currentEmissiveIntensity = 2;
                currentMetalness = 0.9;
                currentRoughness = 0.1;
                colorTransitionStart.current = null;
            } else if (colorTransitionStart.current !== null) {
                const elapsed = performance.now() - colorTransitionStart.current;
                const t = Math.min(elapsed / COLOR_TRANSITION_DURATION, 1);

                if (t < 1) {
                    currentColor = lerpColor("#ffffff", "#ff3030", t);
                    currentEmissive = lerpColor("#ffffff", "#ff0000", t);
                    currentEmissiveIntensity = 2 - (1.7 * t);
                    currentMetalness = 0.9 - (0.4 * t);
                    currentRoughness = 0.1 + (0.4 * t);
                } else {
                    colorTransitionStart.current = null;
                }
            }

            // Update player material
            const playerMaterial = playerRef.current.material as THREE.MeshStandardMaterial;
            if (playerMaterial) {
                playerMaterial.color.set(currentColor);
                playerMaterial.emissive.set(currentEmissive);
                playerMaterial.emissiveIntensity = currentEmissiveIntensity;
                playerMaterial.metalness = currentMetalness;
                playerMaterial.roughness = currentRoughness;
            }

            // Update invincibility effects position
            if (invincibilityEffectsRef.current && isInvincible) {
                invincibilityEffectsRef.current.position.copy(playerPos);
            }

            // Check for key note collection
            setKeyNotes(prev => {
                let collected = false;
                let collectedPosition: [number, number, number] | null = null;

                const updatedNotes = prev.filter(note => {
                    if (note.collected) return false;

                    // Calculate world space position of the note
                    const noteWorldZ = note.position[2] + tunnelPosition.current;
                    const dx = note.position[0] - playerPos.x;
                    const dy = note.position[1] - playerPos.y;
                    const dz = noteWorldZ - playerPos.z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (distance < BALL_RADIUS * 4) { // Increased collection radius
                        collected = true;
                        collectedPosition = note.position;
                        return false;
                    }
                    return true;
                });

                if (collected && collectedPosition) {
                    // Show collection effect
                    setCollectionEffect({
                        position: collectedPosition,
                        time: performance.now()
                    });

                    // Clear effect after animation
                    setTimeout(() => {
                        setCollectionEffect(null);
                    }, 1000);

                    // Clear any existing invincibility timer
                    if (invincibilityTimer.current) {
                        clearTimeout(invincibilityTimer.current);
                    }

                    // Activate invincibility
                    setIsInvincible(true);
                    colorTransitionStart.current = null;
                    console.log("Invincibility activated!");

                    // Set timer to disable invincibility
                    invincibilityTimer.current = setTimeout(() => {
                        setIsInvincible(false);
                        colorTransitionStart.current = performance.now();
                        invincibilityTimer.current = null;
                        console.log("Invincibility deactivated!");
                    }, INVINCIBILITY_DURATION);
                }

                return updatedNotes;
            });

            // Check for color change and update speed
            const currentColorIndex = Math.floor(tunnelPosition.current / (SEGMENT_LENGTH * COLOR_CHANGE_INTERVAL)) % COLOR_SCHEMES.length;
            if (currentColorIndex !== lastColorIndex.current) {
                currentSpeed.current += SPEED_INCREASE;
                lastColorIndex.current = currentColorIndex;
            }

            // Calculate current speed with boost if active
            const effectiveSpeed = currentSpeed.current + (isBoostActive.current ? BOOST_AMOUNT : 0);
            const forwardSpeed = effectiveSpeed * delta;
            tunnelPosition.current += forwardSpeed;

            // Update score
            const newScore = Math.floor(tunnelPosition.current);
            setScore(newScore);
            updateGlobalScore(newScore);

            // Check if we need to add a new segment
            checkAndAddSegment();

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

            // Add camera shake during boost
            if (isBoostActive.current) {
                const shakeAmount = 0.02;
                camera.position.x = Math.sin(Date.now() * 0.01) * shakeAmount;
                camera.position.y = Math.cos(Date.now() * 0.01) * shakeAmount;
            } else {
                camera.position.x = 0;
                camera.position.y = 0;
            }
            camera.position.z = 5;
            camera.lookAt(0, 0, 0);
        }
    });

    // Reset speed when game restarts
    useEffect(() => {
        if (gameState === 'start') {
            currentSpeed.current = INITIAL_MOVE_SPEED;
            lastColorIndex.current = 0;
            setIsInvincible(false);
            colorTransitionStart.current = null;
            if (invincibilityTimer.current) {
                clearTimeout(invincibilityTimer.current);
                invincibilityTimer.current = null;
            }
            setShowGameOver(false);
        }

        // Cleanup function
        return () => {
            if (invincibilityTimer.current) {
                clearTimeout(invincibilityTimer.current);
                invincibilityTimer.current = null;
            }
            colorTransitionStart.current = null;
        };
    }, [gameState]);

    // Add effect to handle game over state
    useEffect(() => {
        if (gameState === 'gameOver') {
            setShowGameOver(true);

            // Add game over styles
            const style = document.createElement('style');
            style.textContent = `
                .game-over-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    pointer-events: none;
                }
                .game-over-text {
                    color: #ff3333;
                    font-size: 5rem;
                    font-weight: bold;
                    text-shadow: 0 0 20px rgba(255,0,0,0.8), 0 0 30px rgba(255,0,0,0.6);
                    margin-bottom: 1rem;
                    animation: pulse 1.5s infinite;
                }
                .restart-text {
                    color: white;
                    font-size: 2rem;
                    text-shadow: 0 0 10px rgba(255,255,255,0.8);
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.9; }
                }
            `;
            document.head.appendChild(style);

            // Create game over container
            const gameOverEl = document.createElement('div');
            gameOverEl.className = 'game-over-overlay';
            gameOverEl.innerHTML = `
                <div class="game-over-text">GAME OVER</div>
                <div class="restart-text">Press R to restart</div>
            `;
            document.body.appendChild(gameOverEl);

            return () => {
                document.body.removeChild(gameOverEl);
                style.remove();
            };
        }
    }, [gameState]);

    // Flatten tunnel tiles for rendering
    const allTunnelTiles = tunnelSegments.flatMap(segment => segment.tiles);

    return (
        <>
            {/* Stars background with increased speed during boost */}
            <Stars
                radius={100}
                depth={50}
                count={5000}
                factor={4}
                saturation={0}
                fade
                speed={1 + (isBoostActive.current ? 2 : 0)}
            />

            {/* Tunnel */}
            <group ref={tunnelRef}>
                {allTunnelTiles.map((tile, index) => {
                    if (!tile.exists) return null;

                    // Determine rotation based on tile type
                    let rotation = [0, 0, 0];
                    if (tile.type === 'floor') rotation = [Math.PI / 2, 0, 0];
                    else if (tile.type === 'ceiling') rotation = [-Math.PI / 2, 0, 0];
                    else if (tile.type === 'leftWall') rotation = [0, Math.PI / 2, 0];
                    else if (tile.type === 'rightWall') rotation = [0, -Math.PI / 2, 0];

                    // Calculate distance-based effects
                    const distanceFromPlayer = Math.abs(tile.position[2] + tunnelPosition.current);
                    const depthFactor = Math.min(distanceFromPlayer / (SEGMENT_LENGTH * VISIBLE_SEGMENTS), 1);

                    // Pulse effect based on position and time
                    const pulseSpeed = 0.2;
                    const pulseIntensity = Math.sin(tile.position[2] * pulseSpeed + Date.now() * 0.001) * 0.3 + 0.7;

                    // Combine all effects for final emissive intensity
                    const finalEmissiveIntensity = TILE_EMISSIVE_INTENSITY * pulseIntensity * (1 - depthFactor * 0.5);

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
                                emissiveIntensity={finalEmissiveIntensity}
                                metalness={0.8}
                                roughness={0.2}
                                transparent={true}
                                opacity={0.9}
                            />
                        </mesh>
                    );
                })}

                {/* Key notes */}
                {keyNotes.map((note, index) => !note.collected && (
                    <group
                        key={`keynote-${index}`}
                        position={note.position}
                        rotation={[0, performance.now() * 0.001 * KEY_NOTE_ROTATION_SPEED, 0]}
                    >
                        {/* Star shape using multiple planes */}
                        {[0, 0.785, 1.57].map((rotation, i) => (
                            <mesh key={i} rotation={[0, 0, rotation]}>
                                <planeGeometry args={[0.4, 0.08]} />
                                <meshStandardMaterial
                                    color="#ffffff"
                                    emissive="#ffffff"
                                    emissiveIntensity={1.5}
                                    metalness={0.9}
                                    roughness={0.1}
                                    transparent
                                    opacity={0.9}
                                />
                            </mesh>
                        ))}
                        {/* Center glow */}
                        <mesh>
                            <sphereGeometry args={[0.1, 16, 16]} />
                            <meshStandardMaterial
                                color="#ffffff"
                                emissive="#ffffff"
                                emissiveIntensity={2}
                                metalness={0.9}
                                roughness={0.1}
                                transparent
                                opacity={0.8}
                            />
                        </mesh>
                        {/* Sparkle effect */}
                        <pointLight
                            intensity={1.2}
                            color="#ffffff"
                            distance={3}
                        />
                        {/* Pulsing outer glow */}
                        <mesh scale={[1 + Math.sin(performance.now() * 0.005) * 0.2, 1 + Math.sin(performance.now() * 0.005) * 0.2, 1]}>
                            <sphereGeometry args={[0.2, 16, 16]} />
                            <meshStandardMaterial
                                color="#ffffff"
                                emissive="#ffffff"
                                emissiveIntensity={1}
                                transparent
                                opacity={0.2}
                            />
                        </mesh>
                    </group>
                ))}

                {/* Collection effect */}
                {collectionEffect && (
                    <group position={collectionEffect.position}>
                        {/* Expanding ring effect */}
                        {[1, 2, 3].map((ring) => {
                            const scale = 1 + ((performance.now() - collectionEffect.time) / 500) * ring;
                            const opacity = Math.max(0, 1 - ((performance.now() - collectionEffect.time) / 1000));

                            return (
                                <mesh key={ring} scale={[scale, scale, scale]}>
                                    <ringGeometry args={[0.2, 0.3, 32]} />
                                    <meshBasicMaterial
                                        color="#ffffff"
                                        transparent
                                        opacity={opacity}
                                        side={DoubleSide}
                                    />
                                </mesh>
                            );
                        })}

                        {/* Burst particles */}
                        {Array.from({ length: 8 }).map((_, i) => {
                            const angle = (i / 8) * Math.PI * 2;
                            const progress = (performance.now() - collectionEffect.time) / 1000;
                            const radius = progress * 2;
                            const opacity = Math.max(0, 1 - progress);

                            return (
                                <mesh
                                    key={i}
                                    position={[
                                        Math.cos(angle) * radius,
                                        Math.sin(angle) * radius,
                                        0
                                    ]}
                                    scale={[0.1, 0.1, 0.1]}
                                >
                                    <sphereGeometry />
                                    <meshBasicMaterial
                                        color="#ffffff"
                                        transparent
                                        opacity={opacity}
                                    />
                                </mesh>
                            );
                        })}

                        {/* Bright flash */}
                        <pointLight
                            intensity={Math.max(0, 2 - ((performance.now() - collectionEffect.time) / 500))}
                            distance={3}
                            color="#ffffff"
                        />
                    </group>
                )}
            </group>

            {/* Dynamic lighting that matches current segment color */}
            <ambientLight intensity={0.3} />
            <pointLight position={[0, 0, 2]} intensity={1.5} color="#ffffff" />
            <pointLight
                position={[0, -1.5, 0]}
                intensity={1.2}
                color={getColorForSegment(Math.floor(tunnelPosition.current / SEGMENT_LENGTH))}
                distance={5}
            />
            <pointLight
                position={[2, 0, -10]}
                intensity={1}
                color={getColorForSegment(Math.floor((tunnelPosition.current + 10) / SEGMENT_LENGTH))}
                distance={15}
            />
            <pointLight
                position={[-2, 0, -20]}
                intensity={1}
                color={getColorForSegment(Math.floor((tunnelPosition.current + 20) / SEGMENT_LENGTH))}
                distance={15}
            />

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

            {/* Player character */}
            <group
                position={[getLanePosition(2), -TUNNEL_SIZE / 2 + BALL_RADIUS, 0]}
                ref={playerRef}
            >
                {/* Core ball */}
                <mesh>
                    <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
                    <meshStandardMaterial
                        color={isInvincible ? "#ffffff" : "#ff3030"}
                        emissive={isInvincible ? "#ffffff" : "#ff0000"}
                        emissiveIntensity={isInvincible ? 2 : 1.2}
                        metalness={isInvincible ? 0.9 : 0.7}
                        roughness={isInvincible ? 0.1 : 0.2}
                    />
                </mesh>

                {/* Energy trails and effects for non-invincible state */}
                {!isInvincible && (
                    <>
                        {/* Pulsing energy ring */}
                        <mesh
                            rotation={[Math.PI / 2, 0, performance.now() * 0.001]}
                        >
                            <torusGeometry args={[BALL_RADIUS * 1.2, BALL_RADIUS * 0.1, 16, 32]} />
                            <meshStandardMaterial
                                color="#ff6060"
                                emissive="#ff0000"
                                emissiveIntensity={0.5 + Math.sin(performance.now() * 0.003) * 0.3}
                                transparent
                                opacity={0.7}
                            />
                        </mesh>

                        {/* Energy particles */}
                        {Array.from({ length: 6 }).map((_, i) => {
                            const angle = (performance.now() * 0.001 + i * Math.PI * 2 / 6) % (Math.PI * 2);
                            const radius = BALL_RADIUS * (1.1 + Math.sin(performance.now() * 0.002 + i) * 0.1);
                            return (
                                <mesh
                                    key={i}
                                    position={[
                                        Math.cos(angle) * radius,
                                        Math.sin(angle) * radius,
                                        0
                                    ]}
                                    scale={[0.08, 0.08, 0.08]}
                                >
                                    <sphereGeometry />
                                    <meshBasicMaterial
                                        color="#ff8080"
                                        transparent
                                        opacity={0.6 + Math.sin(performance.now() * 0.004 + i * 2) * 0.4}
                                    />
                                </mesh>
                            );
                        })}

                        {/* Inner glow */}
                        <pointLight
                            color="#ff4040"
                            intensity={0.8 + Math.sin(performance.now() * 0.003) * 0.2}
                            distance={1.5}
                        />

                        {/* Energy trail */}
                        {Array.from({ length: 3 }).map((_, i) => (
                            <mesh
                                key={`trail-${i}`}
                                position={[0, 0, i * 0.1]}
                                scale={[1 - (i * 0.1), 1 - (i * 0.1), 1]}
                            >
                                <sphereGeometry args={[BALL_RADIUS, 16, 16]} />
                                <meshBasicMaterial
                                    color="#ff6060"
                                    transparent
                                    opacity={0.3 - (i * 0.1)}
                                    depthWrite={false}
                                />
                            </mesh>
                        ))}
                    </>
                )}
            </group>

            {/* Player invincibility effects */}
            {isInvincible && (
                <group
                    ref={invincibilityEffectsRef}
                    position={[playerRef.current?.position.x || 0, playerRef.current?.position.y || 0, playerRef.current?.position.z || 0]}
                >
                    {/* Inner glow */}
                    <pointLight
                        color="#ffffff"
                        intensity={1.5}
                        distance={2}
                    />

                    {/* Outer aura */}
                    <mesh scale={[1 + Math.sin(performance.now() * 0.005) * 0.1, 1 + Math.sin(performance.now() * 0.005) * 0.1, 1]}>
                        <sphereGeometry args={[BALL_RADIUS * 1.5, 32, 32]} />
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive="#ffffff"
                            emissiveIntensity={0.5}
                            transparent={true}
                            opacity={0.3}
                        />
                    </mesh>

                    {/* Particle effect */}
                    {Array.from({ length: 8 }).map((_, i) => {
                        const angle = (performance.now() * 0.001 + i * Math.PI * 2 / 8) % (Math.PI * 2);
                        const radius = BALL_RADIUS * 2;
                        return (
                            <mesh
                                key={i}
                                position={[
                                    Math.cos(angle) * radius,
                                    Math.sin(angle) * radius,
                                    0
                                ]}
                                scale={[0.1, 0.1, 0.1]}
                            >
                                <sphereGeometry />
                                <meshBasicMaterial
                                    color="#ffffff"
                                    transparent
                                    opacity={0.6 + Math.sin(performance.now() * 0.005) * 0.4}
                                />
                            </mesh>
                        );
                    })}
                </group>
            )}
        </>
    );
}