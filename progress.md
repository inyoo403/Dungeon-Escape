Original prompt: 파일 구조 확인하고

1. 페이저 기반 미로게임이고, 첨부한 사진처럼 플레이어 주변을 비추는 랜턴을 추가하고 싶어.

- 2026-03-11: Project structure checked. Actual maze gameplay is in `src/scenes/Dungeons.js`; `Play.js` is the hub scene.
- 2026-03-11: Planned lantern implementation: fullscreen darkness overlay with a soft circular cutout that follows the player in screen space.
- 2026-03-11: Added lantern overlay scaffolding in `Dungeons.js` plus minimal `render_game_to_text` / `advanceTime` hooks in `main.js` for automated inspection.
- 2026-03-11: First screenshot showed the effect working but too bright overall, so darkness was increased and a warm additive glow layer was added on top of the cutout.
- 2026-03-11: User requested a tighter lantern and clearer visual separation. Reduced the light radius again, forced full blackout outside the mask, and recolored floor/wall/corridor/stairs/player for stronger readability inside the lit area.
- 2026-03-11: Follow-up balancing pass: the first tight-lantern result was too cramped to read, so the radius/glow were nudged up slightly while keeping the full-black outside mask.
- 2026-03-11: Clarified follow-up request: the maze itself should be red. Updated room floors, walls, corridor tiles, and maze outlines to a red palette.
- 2026-03-11: Updated again per user clarification: room/base tiles are gray, while the internal maze path tiles remain red. No automated test run performed for this adjustment.
- 2026-03-11: Lantern center mismatch fix: changed the lantern position calculation to derive screen coordinates from the player's world position via `camera.worldView` and zoom, so the light stays centered on the player sprite.
- 2026-03-11: Root cause of the remaining lantern mismatch was the erase stamp using top-left placement while the glow image used center placement. Adjusted erase coordinates by half the lantern texture size so the visible light hole aligns with the player.
- 2026-03-11: Updated the collision maze boundary lines to a bright yellow (`0xffde59`) with thicker stroke so the blocking path lines are visually obvious.
- 2026-03-11: Added per-room indexing (`roomIndex`, `roomLabel`) in the generator and scene-side current-room tracking. The dungeon scene now detects when the player enters a different room and exposes that as `currentRoom`.
- 2026-03-11: Added an explored-area memory overlay. The active lantern still follows the player, while previously lit positions remain faintly visible using a weaker erase mask and a lighter darkness layer.
- 2026-03-11: Fixed explored-area visibility: the separate full-black active lantern overlay was covering the memory layer. Simplified the stack so explored areas are erased directly from the persistent darkness overlay, while the live lantern is only an additive glow on top.
- 2026-03-11: Fixed dungeon entry crash by removing stale explored-mask canvas creation code that still referenced a deleted texture key and produced a null canvas context.
- 2026-03-11: Fixed a second dungeon-entry crash caused by calling `syncLantern()` before `createLanternOverlay()`. The overlay is now created before the first floor loads, and `syncLantern()` guards against a missing glow object.
- 2026-03-11: Fixed unexplored areas leaking through the darkness overlay. The persistent overlay is now fully opaque, and explored areas are revealed only through a separate low-strength `explored-mask` texture instead of the full lantern mask.
- 2026-03-11: Switched lantern memory from screen-space to world-space. The explored overlay is now sized/positioned to the floor bounds and erased using player world coordinates, preventing unexplored rooms from appearing just because the camera moved.
- 2026-03-11: Added one red-circle enemy per room. Enemy spawns are chosen from room floor tiles without overlapping blocked special tiles, enemies wander inside their own room, start chasing only after the player has entered that room, and are never allowed to move outside their assigned room.
- 2026-03-11: Replaced enemy straight-line movement with room-local A* pathfinding based on `openEdges`, so wandering and chase movement now both follow the actual maze path layout inside each room.
- 2026-03-11: Adjusted room activation behavior so enemies remain fixed at their spawn point until the player enters that specific room for the first time. Only activated rooms run wander/chase logic.
- 2026-03-11: Changed enemy circle color from red to purple (`0xb84dff`).
