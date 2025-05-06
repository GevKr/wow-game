# Tech Plan: Run 3 (Simplified Clone)

## Tech Stack

- React + TypeScript
- Three.js (3D rendering)
- Cannon.js (physics engine)
- Tailwind CSS (styling)
- shadcn/ui (UI components)
- Vite (bundler)
- Zustand or Jotai (global state)

---

## Project Structure (under `src/`)

- `components/`

  - `SceneCanvas.tsx` – Initializes canvas and camera
  - `Player.tsx` – Player mesh, movement, and physics
  - `Environment.tsx` – Generates floor tiles and handles procedural scrolling

- `components/ui/`

  - HUD and overlays using `shadcn/ui` primitives

- `hooks/`

  - `useControls.ts` – Keyboard listeners (`←`, `→`, `Space`, `R`)
  - `useFollowCamera.ts` – Locks camera to follow player

- `systems/`

  - `physics.ts` – Cannon.js world, tick updates
  - `platformManager.ts` – Spawns/removes tiles dynamically

- `stores/`

  - `gameStore.ts` – Zustand store to track `gameState`, `score`, `fallState`, etc.

- `loaders/`

  - For future asset additions (models, sounds, etc.)

- `utils/`

  - Math helpers for positioning, wrapping, platform gaps

- `ui/`

  - `HUD.tsx` – Displays score, start/game-over messages

- `shaders/`

  - Optional: animated platform materials or background effects

- `App.tsx`

  - Wraps `SceneCanvas`, `HUD`, and handles routing state

- `main.tsx`
  - Entry point for rendering app

---

## Core Systems

### Player Movement

- Uses Cannon.js body with applied forward force
- Jump only when grounded
- `←` and `→` apply lateral force

### Camera

- `useFollowCamera`: uses Three.js camera to follow player’s physics body

### Platforms

- Spawns a grid of platform tiles
- Each row moves backward (player stays mostly still)
- Random gaps to challenge jumping
- Remove tiles once behind player

### Physics

- Gravity pulls player down
- Check if player is above a platform
- If not → enter falling state

### Game States

- `start`, `playing`, `falling`, `gameOver`
- Managed in `gameStore.ts`

---

## Optional Enhancements

- Use glTF models for player or environment
- Sound effects
- Animated shaders for space tunnel
- Mobile support with touch controls
