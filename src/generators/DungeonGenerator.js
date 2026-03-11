// dungeonGenerator.js
function generateDungeon() {
  const GRID_WIDTH = 52;
  const GRID_HEIGHT = 42;

  // pick number of floors (1-4)
  const numFloors = 1 + Math.floor(Math.random() * 4);
  const dungeon = {
    floors: [],
    totalFloors: numFloors,
  };

  // helper function for random numbers
  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < GRID_WIDTH && y < GRID_HEIGHT;
  }

  function isInsideRoom(x, y, room, padding = 0) {
    return (
      x >= room.x - padding &&
      x < room.x + room.w + padding &&
      y >= room.y - padding &&
      y < room.y + room.h + padding
    );
  }

  function isInsideAnyRoom(x, y, rooms, padding = 0) {
    return rooms.some((room) => isInsideRoom(x, y, room, padding));
  }

  function initRoomMaze(room) {
    room.maze = [];
    for (let y = 0; y < room.h; y++) {
      room.maze[y] = [];
      for (let x = 0; x < room.w; x++) {
        room.maze[y][x] = {
          type: 'wall',
          hasItem: false,
          hasEnemy: false,
        };
      }
    }
  }

  function carveRoomMaze(room) {
    initRoomMaze(room);
    room.miniChambers = [];
    room.openEdges = [];
    room.edgeDoorSlots = {
      left: [],
      right: [],
      top: [],
      bottom: [],
    };

    if (room.w <= 1 || room.h <= 1) return;

    function inMiniChamber(localX, localY) {
      return room.miniChambers.some((c) =>
        localX >= c.x && localX < c.x + c.w &&
        localY >= c.y && localY < c.y + c.h
      );
    }

    function canUse(localX, localY) {
      return (
        localX >= 0 &&
        localY >= 0 &&
        localX < room.w &&
        localY < room.h &&
        !inMiniChamber(localX, localY)
      );
    }

    function nodeKey(x, y) {
      return `${x},${y}`;
    }

    function edgeKey(ax, ay, bx, by) {
      const a = nodeKey(ax, ay);
      const b = nodeKey(bx, by);
      return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    // 1-2 inner mini chambers (2x2..3x3), with a small spacing buffer.
    const requested = rand(1, 2);
    for (
      let attempt = 0;
      attempt < 40 && room.miniChambers.length < requested;
      attempt++
    ) {
      const chamberW = rand(2, Math.min(3, room.w));
      const chamberH = rand(2, Math.min(3, room.h));
      if (room.w - chamberW < 2 || room.h - chamberH < 2) continue;

      const chamberX = rand(1, room.w - chamberW - 1);
      const chamberY = rand(1, room.h - chamberH - 1);

      const overlaps = room.miniChambers.some((c) => {
        const aL = chamberX - 1;
        const aR = chamberX + chamberW;
        const aT = chamberY - 1;
        const aB = chamberY + chamberH;
        const bL = c.x;
        const bR = c.x + c.w - 1;
        const bT = c.y;
        const bB = c.y + c.h - 1;
        return !(aR < bL || aL > bR || aB < bT || aT > bB);
      });
      if (overlaps) continue;

      room.miniChambers.push({
        x: chamberX,
        y: chamberY,
        w: chamberW,
        h: chamberH,
      });
    }

    if (room.miniChambers.length === 0 && room.w >= 5 && room.h >= 5) {
      const chamberW = Math.min(3, Math.max(2, room.w - 2));
      const chamberH = Math.min(3, Math.max(2, room.h - 2));
      const chamberX = clamp(
        Math.floor((room.w - chamberW) / 2),
        1,
        room.w - chamberW - 1,
      );
      const chamberY = clamp(
        Math.floor((room.h - chamberH) / 2),
        1,
        room.h - chamberH - 1,
      );
      room.miniChambers.push({
        x: chamberX,
        y: chamberY,
        w: chamberW,
        h: chamberH,
      });
    }

    // All non-chamber blocks are maze nodes.
    const nodes = [];
    for (let y = 0; y < room.h; y++) {
      for (let x = 0; x < room.w; x++) {
        if (canUse(x, y)) {
          room.maze[y][x].type = 'floor';
          nodes.push({ x, y });
        } else {
          room.maze[y][x].type = 'wall';
        }
      }
    }
    if (nodes.length === 0) return;

    const openEdges = new Set();
    const visited = new Set();

    function neighbors(cell) {
      const out = [];
      const dirs = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];
      for (const dir of dirs) {
        const nx = cell.x + dir.dx;
        const ny = cell.y + dir.dy;
        if (canUse(nx, ny)) out.push({ x: nx, y: ny });
      }
      return out;
    }

    function addEdge(a, b) {
      openEdges.add(edgeKey(a.x, a.y, b.x, b.y));
    }

    function runDfs(seed) {
      const stack = [seed];
      visited.add(nodeKey(seed.x, seed.y));
      while (stack.length > 0) {
        const cur = stack[stack.length - 1];
        const nexts = shuffle(neighbors(cur)).filter((n) =>
          !visited.has(nodeKey(n.x, n.y))
        );
        if (nexts.length === 0) {
          stack.pop();
          continue;
        }
        const next = nexts[0];
        addEdge(cur, next);
        visited.add(nodeKey(next.x, next.y));
        stack.push(next);
      }
    }

    runDfs(nodes[rand(0, nodes.length - 1)]);

    // Connect remaining components if chambers partition the room.
    while (visited.size < nodes.length) {
      const start = nodes.find((n) => !visited.has(nodeKey(n.x, n.y)));
      if (!start) break;

      const q = [start];
      const seen = new Set([nodeKey(start.x, start.y)]);
      const parent = new Map();
      let hit = null;

      while (q.length > 0 && !hit) {
        const cur = q.shift();
        for (const n of neighbors(cur)) {
          const nk = nodeKey(n.x, n.y);
          if (seen.has(nk)) continue;
          seen.add(nk);
          parent.set(nk, nodeKey(cur.x, cur.y));
          if (visited.has(nk)) {
            hit = n;
            break;
          }
          q.push(n);
        }
      }

      if (!hit) break;

      let k = nodeKey(hit.x, hit.y);
      while (k) {
        const prev = parent.get(k);
        if (!prev) break;
        const [x1, y1] = k.split(',').map(Number);
        const [x0, y0] = prev.split(',').map(Number);
        addEdge({ x: x0, y: y0 }, { x: x1, y: y1 });
        visited.add(nodeKey(x0, y0));
        visited.add(nodeKey(x1, y1));
        k = prev;
      }

      runDfs(start);
    }

    // Carve mini chambers as floor and connect each chamber to the maze by exactly one door.
    for (const chamber of room.miniChambers) {
      for (let y = chamber.y; y < chamber.y + chamber.h; y++) {
        for (let x = chamber.x; x < chamber.x + chamber.w; x++) {
          room.maze[y][x].type = 'floor';
          if (x + 1 < chamber.x + chamber.w) {
            openEdges.add(edgeKey(x, y, x + 1, y));
          }
          if (y + 1 < chamber.y + chamber.h) {
            openEdges.add(edgeKey(x, y, x, y + 1));
          }
        }
      }

      const chamberDoorCandidates = [];
      for (let y = chamber.y; y < chamber.y + chamber.h; y++) {
        for (let x = chamber.x; x < chamber.x + chamber.w; x++) {
          const dirs = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
          ];
          for (const dir of dirs) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (canUse(nx, ny)) {
              chamberDoorCandidates.push({ x, y, nx, ny });
            }
          }
        }
      }

      if (chamberDoorCandidates.length > 0) {
        // Remove any existing boundary openings so this chamber has exactly one door.
        for (const candidate of chamberDoorCandidates) {
          openEdges.delete(
            edgeKey(candidate.x, candidate.y, candidate.nx, candidate.ny),
          );
        }

        const chosenDoor =
          chamberDoorCandidates[rand(0, chamberDoorCandidates.length - 1)];
        openEdges.add(
          edgeKey(chosenDoor.x, chosenDoor.y, chosenDoor.nx, chosenDoor.ny),
        );
      }
    }

    room.openEdges = [...openEdges];
    ensureConnectivity(room);
  }

  function ensureConnectivity(room) {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    function key(x, y) {
      return `${x},${y}`;
    }

    function edgeKey(ax, ay, bx, by) {
      const a = key(ax, ay);
      const b = key(bx, by);
      return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    function inMiniChamber(localX, localY) {
      return (room.miniChambers || []).some((c) =>
        localX >= c.x && localX < c.x + c.w &&
        localY >= c.y && localY < c.y + c.h
      );
    }

    function canUse(localX, localY) {
      return (
        localX >= 0 &&
        localY >= 0 &&
        localX < room.w &&
        localY < room.h &&
        !inMiniChamber(localX, localY)
      );
    }

    const nodes = [];
    for (let y = 0; y < room.h; y++) {
      for (let x = 0; x < room.w; x++) {
        if (canUse(x, y)) {
          room.maze[y][x].type = 'floor';
          nodes.push({ x, y });
        } else if (inMiniChamber(x, y)) {
          room.maze[y][x].type = 'floor';
        } else {
          room.maze[y][x].type = 'wall';
        }
      }
    }
    if (nodes.length === 0) {
      room.openEdges = [];
      return;
    }

    const edges = new Set(room.openEdges || []);

    function neighbors(cell) {
      const list = [];
      for (const dir of dirs) {
        const nx = cell.x + dir.dx;
        const ny = cell.y + dir.dy;
        if (canUse(nx, ny)) list.push({ x: nx, y: ny });
      }
      return list;
    }

    function flood(seed) {
      const q = [seed];
      const seen = new Set([key(seed.x, seed.y)]);
      while (q.length > 0) {
        const cur = q.shift();
        for (const n of neighbors(cur)) {
          if (!edges.has(edgeKey(cur.x, cur.y, n.x, n.y))) continue;
          const nk = key(n.x, n.y);
          if (seen.has(nk)) continue;
          seen.add(nk);
          q.push(n);
        }
      }
      return seen;
    }

    let connected = flood(nodes[0]);
    while (connected.size < nodes.length) {
      const start = nodes.find((n) => !connected.has(key(n.x, n.y)));
      if (!start) break;

      const q = [start];
      const seen = new Set([key(start.x, start.y)]);
      const parent = new Map();
      let hit = null;

      while (q.length > 0 && !hit) {
        const cur = q.shift();
        for (const n of neighbors(cur)) {
          const nk = key(n.x, n.y);
          if (seen.has(nk)) continue;
          seen.add(nk);
          parent.set(nk, key(cur.x, cur.y));
          if (connected.has(nk)) {
            hit = n;
            break;
          }
          q.push(n);
        }
      }

      if (!hit) break;

      let k = key(hit.x, hit.y);
      while (k) {
        const prev = parent.get(k);
        if (!prev) break;
        const [x1, y1] = k.split(',').map(Number);
        const [x0, y0] = prev.split(',').map(Number);
        edges.add(edgeKey(x0, y0, x1, y1));
        k = prev;
      }

      connected = flood(nodes[0]);
    }

    room.openEdges = [...edges];
  }

  function carveDoorway(room, outsideTile) {
    let insideX = clamp(outsideTile.x, room.x, room.x + room.w - 1);
    let insideY = clamp(outsideTile.y, room.y, room.y + room.h - 1);

    let side = 'internal';
    if (outsideTile.x < room.x) {
      insideX = room.x;
      side = 'left';
    } else if (outsideTile.x >= room.x + room.w) {
      insideX = room.x + room.w - 1;
      side = 'right';
    } else if (outsideTile.y < room.y) {
      insideY = room.y;
      side = 'top';
    } else if (outsideTile.y >= room.y + room.h) {
      insideY = room.y + room.h - 1;
      side = 'bottom';
    }

    // New rule: if an edge block is a doorway, its adjacent edge blocks cannot also be doorways.
    if (side !== 'internal') {
      const slots = room.edgeDoorSlots || {
        left: [],
        right: [],
        top: [],
        bottom: [],
      };
      room.edgeDoorSlots = slots;

      const desired = (side === 'left' || side === 'right')
        ? clamp(insideY - room.y, 0, room.h - 1)
        : clamp(insideX - room.x, 0, room.w - 1);

      const max = (side === 'left' || side === 'right')
        ? room.h - 1
        : room.w - 1;
      const candidates = [];
      for (let d = 0; d <= max; d++) {
        const low = desired - d;
        const high = desired + d;
        if (low >= 0) candidates.push(low);
        if (d !== 0 && high <= max) candidates.push(high);
      }

      const existing = slots[side];
      const chosen = candidates.find((c) =>
        existing.every((e) => Math.abs(e - c) >= 2)
      );
      const finalSlot = chosen ?? desired;
      existing.push(finalSlot);

      if (side === 'left' || side === 'right') {
        insideY = room.y + finalSlot;
      } else {
        insideX = room.x + finalSlot;
      }
    }

    const localX = insideX - room.x;
    const localY = insideY - room.y;
    room.maze[localY][localX].type = 'floor';

    const inwardX = clamp(
      localX +
        (outsideTile.x < room.x
          ? 1
          : outsideTile.x >= room.x + room.w
          ? -1
          : 0),
      0,
      room.w - 1,
    );
    const inwardY = clamp(
      localY +
        (outsideTile.y < room.y
          ? 1
          : outsideTile.y >= room.y + room.h
          ? -1
          : 0),
      0,
      room.h - 1,
    );
    room.maze[inwardY][inwardX].type = 'floor';
    connectPointToRoomMaze(room, inwardX, inwardY);

    return { x: insideX, y: insideY };
  }

  function connectPointToRoomMaze(room, startX, startY) {
    const key = (x, y) => `${x},${y}`;
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    function inRoom(x, y) {
      return x >= 0 && y >= 0 && x < room.w && y < room.h;
    }

    function blockedByChamber(x, y) {
      return (room.miniChambers || []).some((c) =>
        x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h
      );
    }

    function edgeKey(ax, ay, bx, by) {
      const a = key(ax, ay);
      const b = key(bx, by);
      return a < b ? `${a}|${b}` : `${b}|${a}`;
    }

    if (!inRoom(startX, startY) || blockedByChamber(startX, startY)) return;

    const floorSeeds = [];
    for (let y = 0; y < room.h; y++) {
      for (let x = 0; x < room.w; x++) {
        if (x === startX && y === startY) continue;
        if (blockedByChamber(x, y)) continue;
        if (room.maze[y][x].type === 'floor') floorSeeds.push({ x, y });
      }
    }
    if (floorSeeds.length === 0) return;

    const seedSet = new Set(floorSeeds.map((p) => key(p.x, p.y)));
    const openEdges = new Set(room.openEdges || []);
    const q = [{ x: startX, y: startY }];
    const seen = new Set([key(startX, startY)]);
    const parent = new Map();

    let hit = null;
    while (q.length > 0 && !hit) {
      const cur = q.shift();
      for (const dir of dirs) {
        const nx = cur.x + dir.dx;
        const ny = cur.y + dir.dy;
        if (!inRoom(nx, ny) || blockedByChamber(nx, ny)) continue;

        const k = key(nx, ny);
        if (seen.has(k)) continue;

        seen.add(k);
        parent.set(k, key(cur.x, cur.y));
        if (seedSet.has(k)) {
          hit = { x: nx, y: ny };
          break;
        }
        q.push({ x: nx, y: ny });
      }
    }

    if (!hit) return;

    let k = key(hit.x, hit.y);
    while (k) {
      const [x, y] = k.split(',').map(Number);
      if (!blockedByChamber(x, y)) {
        room.maze[y][x].type = 'floor';
      }

      const prev = parent.get(k);
      if (prev) {
        const [px, py] = prev.split(',').map(Number);
        openEdges.add(edgeKey(x, y, px, py));
      }

      k = parent.get(k);
    }

    room.openEdges = [...openEdges];
    ensureConnectivity(room);
  }

  function pickFloorTileInRoom(room) {
    const floorTiles = [];
    for (let y = 0; y < room.h; y++) {
      for (let x = 0; x < room.w; x++) {
        const cell = room.maze?.[y]?.[x];
        if (cell && cell.type === 'floor') {
          floorTiles.push({ x: room.x + x, y: room.y + y });
        }
      }
    }

    if (floorTiles.length > 0) {
      return floorTiles[rand(0, floorTiles.length - 1)];
    }

    // Fallback to room center if no floor tiles were marked for any reason.
    return {
      x: room.x + Math.floor(room.w / 2),
      y: room.y + Math.floor(room.h / 2),
    };
  }

  function manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function pickSpacedFloorTileInRoom(
    room,
    blockedTiles,
    preferredMinDistance = 5,
    hardMinDistance = 2,
  ) {
    const floorTiles = [];
    for (let y = 0; y < room.h; y++) {
      for (let x = 0; x < room.w; x++) {
        const cell = room.maze?.[y]?.[x];
        if (cell && cell.type === 'floor') {
          floorTiles.push({ x: room.x + x, y: room.y + y });
        }
      }
    }

    if (floorTiles.length === 0) {
      return pickFloorTileInRoom(room);
    }

    shuffle(floorTiles);

    const far = floorTiles.find((tile) =>
      blockedTiles.every((b) =>
        manhattanDistance(tile, b) >= preferredMinDistance
      )
    );
    if (far) return far;

    const acceptable = floorTiles.find((tile) =>
      blockedTiles.every((b) => manhattanDistance(tile, b) >= hardMinDistance)
    );
    if (acceptable) return acceptable;

    return floorTiles[0];
  }

  function pickOutsideAnchor(room, targetRoom) {
    const cx = room.x + Math.floor(room.w / 2);
    const cy = room.y + Math.floor(room.h / 2);
    const tx = targetRoom.x + Math.floor(targetRoom.w / 2);
    const ty = targetRoom.y + Math.floor(targetRoom.h / 2);

    if (Math.abs(tx - cx) >= Math.abs(ty - cy)) {
      if (tx >= cx) {
        return {
          x: room.x + room.w,
          y: clamp(cy, room.y, room.y + room.h - 1),
        };
      }
      return {
        x: room.x - 1,
        y: clamp(cy, room.y, room.y + room.h - 1),
      };
    }

    if (ty >= cy) {
      return {
        x: clamp(cx, room.x, room.x + room.w - 1),
        y: room.y + room.h,
      };
    }
    return {
      x: clamp(cx, room.x, room.x + room.w - 1),
      y: room.y - 1,
    };
  }

  function getOutsideAnchorCandidates(room, targetRoom) {
    const candidates = [];
    const cx = room.x + Math.floor(room.w / 2);
    const cy = room.y + Math.floor(room.h / 2);
    const tx = targetRoom.x + Math.floor(targetRoom.w / 2);
    const ty = targetRoom.y + Math.floor(targetRoom.h / 2);

    const horizontalPrimary = Math.abs(tx - cx) >= Math.abs(ty - cy);

    if (horizontalPrimary) {
      const sideX = tx >= cx ? room.x + room.w : room.x - 1;
      for (let y = room.y; y < room.y + room.h; y++) {
        candidates.push({ x: sideX, y });
      }
      const altY = ty >= cy ? room.y + room.h : room.y - 1;
      for (let x = room.x; x < room.x + room.w; x++) {
        candidates.push({ x, y: altY });
      }
    } else {
      const sideY = ty >= cy ? room.y + room.h : room.y - 1;
      for (let x = room.x; x < room.x + room.w; x++) {
        candidates.push({ x, y: sideY });
      }
      const altX = tx >= cx ? room.x + room.w : room.x - 1;
      for (let y = room.y; y < room.y + room.h; y++) {
        candidates.push({ x: altX, y });
      }
    }

    const primary = pickOutsideAnchor(room, targetRoom);
    const unique = new Map();
    unique.set(pathKey(primary.x, primary.y), primary);
    shuffle(candidates).forEach((c) => unique.set(pathKey(c.x, c.y), c));
    return [...unique.values()];
  }

  function pathKey(x, y) {
    return `${x},${y}`;
  }

  function findPath(start, goal, rooms, occupied) {
    if (!inBounds(start.x, start.y) || !inBounds(goal.x, goal.y)) return null;
    if (occupied.has(pathKey(start.x, start.y))) return null;
    if (occupied.has(pathKey(goal.x, goal.y))) return null;

    const queue = [start];
    const visited = new Set([pathKey(start.x, start.y)]);
    const parents = new Map();
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.x === goal.x && current.y === goal.y) {
        const path = [];
        let key = pathKey(goal.x, goal.y);
        while (key) {
          const [xStr, yStr] = key.split(',');
          path.push({ x: Number(xStr), y: Number(yStr) });
          key = parents.get(key);
        }
        path.reverse();
        return path;
      }

      for (const dir of dirs) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const nKey = pathKey(nx, ny);
        if (!inBounds(nx, ny) || visited.has(nKey)) continue;

        // Keep corridors from hugging room walls; they should touch rooms only at anchors.
        const isAnchor = (nx === start.x && ny === start.y) ||
          (nx === goal.x && ny === goal.y);
        if (isInsideAnyRoom(nx, ny, rooms, 0)) continue;
        if (!isAnchor && isInsideAnyRoom(nx, ny, rooms, 1)) continue;

        if (occupied.has(nKey)) continue;

        visited.add(nKey);
        parents.set(nKey, pathKey(current.x, current.y));
        queue.push({ x: nx, y: ny });
      }
    }

    return null;
  }

  function addDeadEndPath(mainPath, rooms, occupied, deadEndIndex) {
    if (!mainPath || mainPath.length < 4) return null;

    const branchPoint = mainPath[rand(1, mainPath.length - 2)];
    const dirs = shuffle([
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ]);

    for (const dir of dirs) {
      const length = rand(2, 4);
      const firstX = branchPoint.x + dir.dx;
      const firstY = branchPoint.y + dir.dy;
      const firstKey = pathKey(firstX, firstY);

      if (
        !inBounds(firstX, firstY) ||
        isInsideAnyRoom(firstX, firstY, rooms, 0) ||
        occupied.has(firstKey)
      ) {
        continue;
      }

      const points = [{ x: branchPoint.x, y: branchPoint.y }, {
        x: firstX,
        y: firstY,
      }];
      let ok = true;

      for (let step = 2; step <= length; step++) {
        const nx = branchPoint.x + dir.dx * step;
        const ny = branchPoint.y + dir.dy * step;
        const key = pathKey(nx, ny);

        if (
          !inBounds(nx, ny) || isInsideAnyRoom(nx, ny, rooms, 0) ||
          occupied.has(key)
        ) {
          ok = false;
          break;
        }

        points.push({ x: nx, y: ny });
      }

      if (ok && points.length >= 3) {
        for (let i = 1; i < points.length; i++) {
          occupied.add(pathKey(points[i].x, points[i].y));
        }
        return {
          from: 'deadend',
          to: `deadend-${deadEndIndex}`,
          points,
        };
      }
    }

    return null;
  }

  // make each floor
  for (let f = 0; f < numFloors; f++) {
    // how many rooms on this floor? (2-4)
    const numRooms = rand(2, 4);
    const rooms = [];

    // make rooms that don't overlap
    for (let r = 0; r < numRooms; r++) {
      let attempts = 0;
      let placed = false;

      while (!placed && attempts < 100) {
        // random size between 5 and 10
        const w = rand(5, 10);
        const h = rand(5, 10);
        // random position (leaving margins)
        const x = rand(2, GRID_WIDTH - 3 - w);
        const y = rand(2, GRID_HEIGHT - 3 - h);

        // check if this spot overlaps any existing room
        let overlap = false;
        for (const room of rooms) {
          if (
            !(x + w + 2 < room.x ||
              x > room.x + room.w + 2 ||
              y + h + 2 < room.y ||
              y > room.y + room.h + 2)
          ) {
            overlap = true;
            break;
          }
        }

        if (!overlap) {
          // make the room
          const newRoom = {
            id: `f${f}r${r}`,
            x: x,
            y: y,
            w: w,
            h: h,
            maze: [], // will fill in later
            items: [],
            enemies: [],
            chests: [],
          };
          rooms.push(newRoom);
          placed = true;
        }
        attempts++;
      }
    }

    // ensure we always have at least two rooms
    if (rooms.length < 2) {
      rooms.length = 0;
      rooms.push({
        id: `f${f}r0`,
        x: 6,
        y: 6,
        w: 8,
        h: 8,
        maze: [],
        items: [],
        enemies: [],
        chests: [],
      });
      rooms.push({
        id: `f${f}r1`,
        x: 28,
        y: 24,
        w: 8,
        h: 8,
        maze: [],
        items: [],
        enemies: [],
        chests: [],
      });
    }

    // generate an actual maze in each room + occasional mini chamber
    rooms.forEach((room) => {
      carveRoomMaze(room);

      // Keep item/enemy/chest data empty for now; visual focus is stairs + exit.
      room.items = [];
      room.enemies = [];
      room.chests = [];
    });

    // connect rooms with pathfinding outside room boundaries
    rooms.sort((a, b) => a.x + a.y - (b.x + b.y));
    rooms.forEach((room, index) => {
      room.roomIndex = index + 1;
      room.roomLabel = `Room ${room.roomIndex}`;
    });
    const paths = [];
    const occupiedPathCells = new Set();
    const roomDoorTiles = new Map(rooms.map((room) => [room.id, new Set()]));
    let deadEndIndex = 0;

    for (let i = 0; i < rooms.length - 1; i++) {
      const r1 = rooms[i];
      const r2 = rooms[i + 1];
      const startCandidates = getOutsideAnchorCandidates(r1, r2);
      const goalCandidates = getOutsideAnchorCandidates(r2, r1);

      let pathPoints = null;
      for (const start of startCandidates) {
        for (const goal of goalCandidates) {
          pathPoints = findPath(start, goal, rooms, occupiedPathCells);
          if (pathPoints) break;
        }
        if (pathPoints) break;
      }

      // Fallback: allow path overlap if strict mode cannot connect rooms.
      if (!pathPoints) {
        for (const start of startCandidates) {
          for (const goal of goalCandidates) {
            pathPoints = findPath(start, goal, rooms, new Set());
            if (pathPoints) break;
          }
          if (pathPoints) break;
        }
      }

      if (!pathPoints || pathPoints.length < 2) {
        continue;
      }

      const startDoor = carveDoorway(r1, pathPoints[0]);
      const endDoor = carveDoorway(r2, pathPoints[pathPoints.length - 1]);

      roomDoorTiles.get(r1.id).add(pathKey(startDoor.x, startDoor.y));
      roomDoorTiles.get(r2.id).add(pathKey(endDoor.x, endDoor.y));

      const fullPathPoints = [startDoor, ...pathPoints, endDoor];

      fullPathPoints.forEach((p) => occupiedPathCells.add(pathKey(p.x, p.y)));

      paths.push({
        from: r1.id,
        to: r2.id,
        points: fullPathPoints,
      });

      const deadEnd = addDeadEndPath(
        fullPathPoints,
        rooms,
        occupiedPathCells,
        deadEndIndex,
      );
      if (deadEnd) {
        deadEndIndex++;
        paths.push(deadEnd);
      }
    }

    const isTileInsideRoom = (tileX, tileY, room) => {
      return (
        tileX >= room.x &&
        tileX < room.x + room.w &&
        tileY >= room.y &&
        tileY < room.y + room.h
      );
    };

    const touchesRoomBoundary = (tileX, tileY, room) => {
      const neighbors = [
        { x: tileX + 1, y: tileY },
        { x: tileX - 1, y: tileY },
        { x: tileX, y: tileY + 1 },
        { x: tileX, y: tileY - 1 },
      ];
      return neighbors.some((n) => {
        if (!isTileInsideRoom(n.x, n.y, room)) return false;
        const lx = n.x - room.x;
        const ly = n.y - room.y;
        return lx === 0 || ly === 0 || lx === room.w - 1 || ly === room.h - 1;
      });
    };

    const touchesDoorForRoom = (tileX, tileY, room, doorSet) => {
      if (!doorSet || doorSet.size === 0) return false;
      const neighbors = [
        { x: tileX + 1, y: tileY },
        { x: tileX - 1, y: tileY },
        { x: tileX, y: tileY + 1 },
        { x: tileX, y: tileY - 1 },
      ];
      return neighbors.some((n) => {
        if (!isTileInsideRoom(n.x, n.y, room)) return false;
        return doorSet.has(pathKey(n.x, n.y));
      });
    };

    // Corridors may run alongside rooms; keep only the boundary-touching tiles
    // that are actually adjacent to designated doorway blocks.
    const prunedPathCells = new Set();
    occupiedPathCells.forEach((cellKey) => {
      const [x, y] = cellKey.split(',').map(Number);

      // Keep room-internal tiles (door cells and any fallback internals).
      if (rooms.some((room) => isTileInsideRoom(x, y, room))) {
        prunedPathCells.add(cellKey);
        return;
      }

      let invalidTouch = false;
      for (const room of rooms) {
        if (!touchesRoomBoundary(x, y, room)) continue;
        const doorSet = roomDoorTiles.get(room.id);
        if (!touchesDoorForRoom(x, y, room, doorSet)) {
          invalidTouch = true;
          break;
        }
      }

      if (!invalidTouch) {
        prunedPathCells.add(cellKey);
      }
    });

    occupiedPathCells.clear();
    prunedPathCells.forEach((k) => occupiedPathCells.add(k));

    // Final room pass: door carving and corridor joins can create tiny islands;
    // normalize each room so every room floor cell is connected.
    rooms.forEach((room) => ensureConnectivity(room));

    // add stairs if there's another floor
    const stairs = [];
    const blockedSpecialTiles = [];

    if (f < numFloors - 1) {
      const stairRoom = rooms[Math.floor(Math.random() * rooms.length)];
      const stairTile = pickSpacedFloorTileInRoom(
        stairRoom,
        blockedSpecialTiles,
      );
      stairs.push({
        x: stairTile.x,
        y: stairTile.y,
        dir: 'down',
        toFloor: f + 1,
      });
      blockedSpecialTiles.push(stairTile);
    }

    if (f > 0) {
      const stairRoom = rooms[Math.floor(Math.random() * rooms.length)];
      const stairTile = pickSpacedFloorTileInRoom(
        stairRoom,
        blockedSpecialTiles,
      );
      stairs.push({
        x: stairTile.x,
        y: stairTile.y,
        dir: 'up',
        toFloor: f - 1,
      });
      blockedSpecialTiles.push(stairTile);
    }

    // mark start room on first floor
    if (f === 0 && rooms.length > 0) {
      rooms[0].isStart = true;
      const startTile = pickSpacedFloorTileInRoom(
        rooms[0],
        blockedSpecialTiles,
        4,
        2,
      );
      rooms[0].startPos = { x: startTile.x, y: startTile.y };
      blockedSpecialTiles.push(startTile);
    }

    // mark end room on last floor
    if (f === numFloors - 1 && rooms.length > 0) {
      rooms[rooms.length - 1].isEnd = true;
      const endTile = pickSpacedFloorTileInRoom(
        rooms[rooms.length - 1],
        blockedSpecialTiles,
        6,
        3,
      );
      rooms[rooms.length - 1].endPos = { x: endTile.x, y: endTile.y };
      blockedSpecialTiles.push(endTile);
    }

    // add one enemy spawn per room without overlapping player/stairs/exit tiles
    rooms.forEach((room) => {
      const enemyTile = pickSpacedFloorTileInRoom(
        room,
        blockedSpecialTiles,
        4,
        2,
      );
      room.enemies = [{
        id: `${room.id}-enemy-0`,
        roomId: room.id,
        x: enemyTile.x,
        y: enemyTile.y,
      }];
      blockedSpecialTiles.push(enemyTile);
    });

    dungeon.floors.push({
      index: f,
      rooms: rooms,
      paths: paths,
      stairs: stairs,
      corridorTiles: [...occupiedPathCells].map((key) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      }),
    });
  }

  return dungeon;
}

globalThis.generateDungeon = generateDungeon;
