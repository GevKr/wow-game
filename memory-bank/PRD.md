# PRD: Run 3 (Simplified Clone)

## Overview

A 3D endless runner game inspired by _Run 3_. The player controls a character running through a floating tunnel with missing floor tiles. The objective is to survive as long as possible without falling.

## Core Gameplay Loop

1. **Start Screen**

   - Prompt: "Press any key to start"
   - Show basic controls

2. **Gameplay**

   - The player auto-runs forward
   - Can move left/right and jump to avoid gaps
   - If the player falls off, game ends

3. **Game Over**
   - Display final score (distance/time)
   - Show "Press R to Restart"

## Controls

| Key     | Action     |
| ------- | ---------- |
| `←`     | Move Left  |
| `→`     | Move Right |
| `Space` | Jump       |
| `R`     | Restart    |

## Visual Style

- Minimalist space tunnel with floating tiles
- Player is a simple 3D shape (e.g. capsule or box)
- Tiles disappear behind the player to simulate motion
- Basic UI with HUD (distance counter, restart prompt)

## Win/Loss Conditions

- **Lose:** Fall into space (no platform below player)
- **No win condition:** endless until fall

## User Interface (HUD)

- Score (time/distance survived)
- Game state messages: Start, Game Over, Restart
