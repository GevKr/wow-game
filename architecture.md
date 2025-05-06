# Game Architecture

## Overview

This is a 3D runner game built with React Three Fiber where the player can move between different surfaces (floor, walls, ceiling) in a tunnel while avoiding gaps.

## Key Files

### `/src/components/Game2D.tsx`

The main game component that implements:

- 3D tunnel generation with floor, walls, and ceiling
- Player movement logic between lanes
- Surface transitions (floor, walls, ceiling)
- Physics (gravity, jumping, collisions)
- Game states (start, playing, game over)

### `/src/components/Scene.tsx`

Wrapper component for the 3D scene that sets up the canvas and renderer.

### `/src/components/GameObjects.tsx`

Contains helper components for game objects.

### `/src/components/ui/`

Contains UI components from shadcn/ui.

### `/src/App.tsx`

Main application component that integrates the 3D game.

### `/src/main.tsx`

Entry point for the application.

## Key Architecture Components

### Movement System

- Player moves between 5 lanes on each surface
- LEFT/RIGHT keys move between lanes
- At edge lanes, player can transition to adjacent surfaces:
  - From floor: LEFT → left wall, RIGHT → right wall
  - From left wall: LEFT → floor, RIGHT (at top) → ceiling
  - From right wall: LEFT (at top) → ceiling, RIGHT → floor
  - From ceiling: LEFT → right wall, RIGHT → left wall

### Surface System

- Floor, ceiling, and left/right walls form a complete tunnel
- Each surface has its own gravity direction
- Transitions between surfaces include camera rotation
- Game automatically progresses forward through the tunnel

### Game Loop

- Uses React Three Fiber's useFrame hook for the game loop
- Handles physics, collisions, and surface transitions
- Detects falls through gaps
- Updates score based on distance traveled

### Tile System

- Procedurally generates tunnel with tiles
- Different difficulty patterns for gaps
- Each surface (floor, walls, ceiling) has its own tiles
- Collision detection against these tiles

## Technical Implementation

- Uses Three.js via React Three Fiber
- React hooks for state management
- Vector3 and Euler for 3D math
- Dynamic difficulty scaling based on progress
- Camera perspective changes when transitioning between surfaces

## Game Mechanics

- Continuous forward movement
- Lane-based side movement
- Surface transitions at edges
- Jump to avoid gaps
- Score based on distance traveled
- Game over on falling through gaps
