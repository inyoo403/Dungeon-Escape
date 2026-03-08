# Dungeon-Escape

This game is a roguelike in which the player explores a procedurally generated dungeon, searches for chests, gathers resources, and attempts to escape alive. The core gameplay loop follows the structure: Explore -> Loot -> Craft -> Risk -> Escape.

---
### Run the game

In the Codespaces terminal:

```bash
npm install
npm run dev

```
## Changelog (for team)

### Modified files

| File | Changes |
|------|---------|
| `src/scenes/Dungeons.js` | Dungeon scene: movement/collision, exit (Q), maze colors |
| `src/generators/DungeonGenerator.js` | Dungeon generation: end room & down-stairs placement |

### Summary

- **Dungeon entry/exit**: Enter via DUNGEON button on Play scene; press **Q** in dungeon to return to hub (Play). Bottom hint: "Q: Leave dungeon".
- **Maze visibility**: Floor (green), walls (blue-gray), barrier lines (bronze 3px), corridors (slate blue-gray).
- **Player collision**: Replaced center-only check with **circle collider** (radius 8px, 5-point check) so the player no longer clips through walls.
- **Movement**: Speed set to 90 px/s; delta-based movement for consistent speed across frame rates.
- **End room & down stairs**: EXIT and down-stairs are placed in the **furthest reachable room** from spawn (path-based).
