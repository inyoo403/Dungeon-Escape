// dungeon.js

class Dungeons extends Phaser.Scene {
  constructor() {
    super('Dungeons');

    // player stuff
    this.player = null;
    this.playerRadius = 8;
    this.speed = 90; // pixels per second (delta-based)
    this.keys = {};

    // dungeon stuff
    this.dungeon = null;
    this.currentFloor = 0;
    this.playerX = 0;
    this.playerY = 0;

    // drawing stuff
    this.tileSize = 20;
    this.worldOffsetX = 0;
    this.worldOffsetY = 0;
    this.floorBounds = { minX: 0, minY: 0, width: 800, height: 600 };
    this.graphics = null;
    this.stairPrompt = null;
    this.floorDecorTexts = [];
    this.walkableTiles = new Set();
    this.exitHintText = null;
  }

  create() {
    this.resetForFreshDungeonRun();

    // generate the dungeon
    this.dungeon = generateDungeon();
    console.log('Dungeon made:', this.dungeon);

    // set up keyboard (WASD)
    this.keys = this.input.keyboard.addKeys({
      'q': Phaser.Input.Keyboard.KeyCodes.Q,
      'w': Phaser.Input.Keyboard.KeyCodes.W,
      'a': Phaser.Input.Keyboard.KeyCodes.A,
      's': Phaser.Input.Keyboard.KeyCodes.S,
      'd': Phaser.Input.Keyboard.KeyCodes.D,
      'e': Phaser.Input.Keyboard.KeyCodes.E,
    });

    // load first floor
    this.loadFloor(0);

    // camera follows player
    this.cameras.main.startFollow(this.player);

    // fixed UI hint: how to leave dungeon
    this.exitHintText = this.add.text(
      20,
      560,
      'Q: Leave dungeon (back to garden)',
      {
        fontSize: '16px',
        fill: '#fff',
        backgroundColor: '#000',
        padding: { x: 6, y: 4 },
      },
    );
    this.exitHintText.setScrollFactor(0);
  }

  loadFloor(floorNum) {
    this.currentFloor = floorNum;
    const floor = this.dungeon.floors[floorNum];
    this.nearExit = false;

    // clear old graphics
    if (this.graphics) this.graphics.clear();
    this.graphics = this.add.graphics();
    this.graphics.setDepth(0);
    this.destroyDecorTexts();

    // calculate floor offset/bounds before drawing
    this.computeFloorLayout(floor);

    // draw everything
    this.drawFloor(floor);
    this.rebuildWalkableTiles(floor);

    // place player
    if (!this.player) {
      // first time - find start room
      const startRoom = floor.rooms.find((r) => r.isStart);
      if (startRoom && startRoom.startPos) {
        this.player = this.add.circle(
          this.tileCenterX(startRoom.startPos.x),
          this.tileCenterY(startRoom.startPos.y),
          this.playerRadius,
          0x00ff00,
        );
        this.player.setDepth(20);
      } else {
        const fallback = this.findFallbackSpawnTile(floor);
        this.player = this.add.circle(
          this.tileCenterX(fallback.x),
          this.tileCenterY(fallback.y),
          this.playerRadius,
          0x00ff00,
        );
        this.player.setDepth(20);
      }
    } else {
      // coming from another floor - put at stairs
      const entryStair = floor.stairs.find((s) =>
        s.dir === (this.lastStairDir === 'down' ? 'up' : 'down')
      );
      if (entryStair) {
        this.player.setPosition(
          this.tileCenterX(entryStair.x),
          this.tileCenterY(entryStair.y),
        );
      } else {
        const fallback = this.findFallbackSpawnTile(floor);
        this.player.setPosition(
          this.tileCenterX(fallback.x),
          this.tileCenterY(fallback.y),
        );
      }
      this.player.setDepth(20);
    }

    this.cameras.main.setBounds(
      this.floorBounds.minX,
      this.floorBounds.minY,
      this.floorBounds.width,
      this.floorBounds.height,
    );

    // floor number text
    if (this.floorText) this.floorText.destroy();
    this.floorText = this.add.text(
      650,
      20,
      `Floor ${floorNum + 1}/${this.dungeon.totalFloors}`,
      {
        fontSize: '20px',
        fill: '#fff',
      },
    );
    this.floorText.setScrollFactor(0);
  }

  drawFloor(floor) {
    const size = this.tileSize; // size of each tile in pixels

    // draw rooms
    floor.rooms.forEach((room) => {
      // draw room outline
      this.graphics.lineStyle(2, 0x999999);
      this.graphics.strokeRect(
        this.tileToWorldX(room.x),
        this.tileToWorldY(room.y),
        room.w * size,
        room.h * size,
      );

      // draw maze tiles
      for (let y = 0; y < room.h; y++) {
        for (let x = 0; x < room.w; x++) {
          const tile = room.maze[y][x];
          const worldX = this.tileToWorldX(room.x + x);
          const worldY = this.tileToWorldY(room.y + y);

          // floor (walkable) vs wall (blocked) - higher contrast
          if (tile.type === 'floor') {
            this.graphics.fillStyle(0x6b8e6b, 1); // sage green - walkable path
            this.graphics.fillRect(worldX, worldY, size - 1, size - 1);
          } else {
            this.graphics.fillStyle(0x2d2d3d, 1); // dark blue-gray - wall
            this.graphics.fillRect(worldX, worldY, size - 1, size - 1);
          }

          // items (yellow dots)
          if (tile.hasItem) {
            this.graphics.fillStyle(0xffff00, 1);
            this.graphics.fillCircle(worldX + size / 2, worldY + size / 2, 4);
          }

          // enemies (red squares)
          if (tile.hasEnemy) {
            this.graphics.fillStyle(0xff0000, 1);
            this.graphics.fillRect(worldX + 5, worldY + 5, 10, 10);
          }
        }
      }

      // Draw wall edges between adjacent floor blocks that are NOT connected.
      const openEdges = new Set(room.openEdges || []);
      this.graphics.lineStyle(3, 0x8b6914, 1); // bronze - visible barrier
      for (let y = 0; y < room.h; y++) {
        for (let x = 0; x < room.w; x++) {
          if (room.maze[y][x].type !== 'floor') continue;

          // Right shared edge
          if (x + 1 < room.w && room.maze[y][x + 1]?.type === 'floor') {
            if (!this.isRoomEdgeOpen(openEdges, x, y, x + 1, y)) {
              const wx = this.tileToWorldX(room.x + x + 1);
              const wy = this.tileToWorldY(room.y + y);
              this.graphics.lineBetween(wx, wy, wx, wy + size);
            }
          }

          // Bottom shared edge
          if (y + 1 < room.h && room.maze[y + 1][x]?.type === 'floor') {
            if (!this.isRoomEdgeOpen(openEdges, x, y, x, y + 1)) {
              const wx = this.tileToWorldX(room.x + x);
              const wy = this.tileToWorldY(room.y + y + 1);
              this.graphics.lineBetween(wx, wy, wx + size, wy);
            }
          }
        }
      }
    });

    // draw paths (corridors - distinct from room floor)
    const corridorTiles = floor.corridorTiles || [];
    corridorTiles.forEach((tile) => {
      const wx = this.tileToWorldX(tile.x);
      const wy = this.tileToWorldY(tile.y);
      this.graphics.fillStyle(0x5a6a7a, 1); // slate blue-gray
      this.graphics.fillRect(wx, wy, size - 1, size - 1);
    });

    // draw stairs
    floor.stairs.forEach((stair) => {
      const sx = this.tileToWorldX(stair.x);
      const sy = this.tileToWorldY(stair.y);

      // stair color (green for up, orange for down)
      this.graphics.fillStyle(stair.dir === 'up' ? 0x00aa00 : 0xaa5500, 1);
      this.graphics.fillRect(sx, sy, size - 1, size - 1);

      // stair symbol
      const symbol = stair.dir === 'up' ? '▲' : '▼';
      const stairText = this.add.text(sx + size / 2, sy + size / 2, symbol, {
        fontSize: '16px',
        fill: '#fff',
      }).setOrigin(0.5);
      this.floorDecorTexts.push(stairText);
    });

    // draw exit symbol in end room (last floor)
    const endRoom = floor.rooms.find((r) => r.isEnd);
    if (endRoom) {
      const ex = endRoom.endPos
        ? endRoom.endPos.x
        : endRoom.x + Math.floor(endRoom.w / 2);
      const ey = endRoom.endPos
        ? endRoom.endPos.y
        : endRoom.y + Math.floor(endRoom.h / 2);
      const exitText = this.add.text(
        this.tileCenterX(ex),
        this.tileCenterY(ey),
        'EXIT',
        {
          fontSize: '12px',
          fill: '#0ff',
          backgroundColor: '#000',
          padding: { x: 3, y: 2 },
        },
      ).setOrigin(0.5);
      this.floorDecorTexts.push(exitText);
    }
  }

  update(time, delta) {
    if (!this.player) return;
    const floor = this.dungeon.floors[this.currentFloor];

    // movement (WASD) - delta-based for consistent speed
    let dx = 0, dy = 0;
    if (this.keys.w.isDown) dy = -1;
    if (this.keys.s.isDown) dy = 1;
    if (this.keys.a.isDown) dx = -1;
    if (this.keys.d.isDown) dx = 1;

    // normalize diagonal
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    const moveAmount = (this.speed * delta) / 1000;
    const desiredX = this.player.x + dx * moveAmount;
    const desiredY = this.player.y + dy * moveAmount;

    // Constrain player to walkable maze/corridor tiles (full circle collision).
    if (
      this.canMoveWorld(this.player.x, this.player.y, desiredX, desiredY, floor)
    ) {
      this.player.x = desiredX;
      this.player.y = desiredY;
    } else if (
      this.canMoveWorld(
        this.player.x,
        this.player.y,
        desiredX,
        this.player.y,
        floor,
      )
    ) {
      this.player.x = desiredX;
    } else if (
      this.canMoveWorld(
        this.player.x,
        this.player.y,
        this.player.x,
        desiredY,
        floor,
      )
    ) {
      this.player.y = desiredY;
    }

    // keep player in current floor camera bounds
    const r = this.playerRadius;
    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      this.floorBounds.minX + r,
      this.floorBounds.minX + this.floorBounds.width - r,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      this.floorBounds.minY + r,
      this.floorBounds.minY + this.floorBounds.height - r,
    );

    // check stairs
    this.checkStairs();

    // check exit (end room)
    this.checkExit();

    // check E key for stairs/exit
    if (Phaser.Input.Keyboard.JustDown(this.keys.e)) {
      if (this.nearExit) {
        this.scene.start('Play');
      } else if (this.nearStair) {
        this.useStairs(this.nearStair);
      }
    }

    // quick escape back to hub screen
    if (Phaser.Input.Keyboard.JustDown(this.keys.q)) {
      this.scene.start('Play');
    }
  }

  checkStairs() {
    const floor = this.dungeon.floors[this.currentFloor];
    let found = null;

    floor.stairs.forEach((stair) => {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.tileCenterX(stair.x),
        this.tileCenterY(stair.y),
      );
      if (dist < 25) found = stair;
    });

    if (found) {
      this.nearStair = found;
      if (!this.stairPrompt) {
        this.stairPrompt = this.add.text(
          this.player.x,
          this.player.y - 30,
          'Press E to go ' + (found.dir === 'up' ? 'UP' : 'DOWN'),
          {
            fontSize: '14px',
            fill: '#ff0',
            backgroundColor: '#000',
            padding: { x: 4, y: 2 },
          },
        ).setOrigin(0.5);
      } else {
        this.stairPrompt.setPosition(this.player.x, this.player.y - 30);
      }
    } else {
      this.nearStair = null;
      if (this.stairPrompt) {
        this.stairPrompt.destroy();
        this.stairPrompt = null;
      }
    }
  }

  useStairs(stair) {
    this.lastStairDir = stair.dir;
    this.loadFloor(stair.toFloor);

    if (this.stairPrompt) {
      this.stairPrompt.destroy();
      this.stairPrompt = null;
    }
  }

  checkExit() {
    const floor = this.dungeon.floors[this.currentFloor];
    const endRoom = floor.rooms.find((r) => r.isEnd);
    this.nearExit = false;

    if (endRoom) {
      // check if player is in end room
      if (
        this.player.x > this.tileToWorldX(endRoom.x) &&
        this.player.x < this.tileToWorldX(endRoom.x + endRoom.w) &&
        this.player.y > this.tileToWorldY(endRoom.y) &&
        this.player.y < this.tileToWorldY(endRoom.y + endRoom.h)
      ) {
        this.nearExit = true;
        // show exit prompt
        if (!this.exitPrompt) {
          this.exitPrompt = this.add.text(
            this.player.x,
            this.player.y - 30,
            'Press E to exit dungeon',
            {
              fontSize: '14px',
              fill: '#0ff',
              backgroundColor: '#000',
              padding: { x: 4, y: 2 },
            },
          ).setOrigin(0.5);
        } else {
          this.exitPrompt.setPosition(this.player.x, this.player.y - 30);
        }
      } else {
        if (this.exitPrompt) {
          this.exitPrompt.destroy();
          this.exitPrompt = null;
        }
      }
    }
  }

  tileToWorldX(tileX) {
    return this.worldOffsetX + tileX * this.tileSize;
  }

  tileToWorldY(tileY) {
    return this.worldOffsetY + tileY * this.tileSize;
  }

  tileCenterX(tileX) {
    return this.tileToWorldX(tileX) + this.tileSize / 2;
  }

  tileCenterY(tileY) {
    return this.tileToWorldY(tileY) + this.tileSize / 2;
  }

  destroyDecorTexts() {
    this.floorDecorTexts.forEach((textObj) => textObj.destroy());
    this.floorDecorTexts = [];
  }

  computeFloorLayout(floor) {
    const points = [];

    floor.rooms.forEach((room) => {
      points.push({ x: room.x, y: room.y });
      points.push({ x: room.x + room.w, y: room.y + room.h });
    });

    floor.paths.forEach((path) => {
      path.points.forEach((p) => points.push({ x: p.x, y: p.y }));
    });

    floor.stairs.forEach((stair) => {
      points.push({ x: stair.x, y: stair.y });
    });

    let minTileX = Number.POSITIVE_INFINITY;
    let minTileY = Number.POSITIVE_INFINITY;
    let maxTileX = Number.NEGATIVE_INFINITY;
    let maxTileY = Number.NEGATIVE_INFINITY;

    points.forEach((p) => {
      minTileX = Math.min(minTileX, p.x);
      minTileY = Math.min(minTileY, p.y);
      maxTileX = Math.max(maxTileX, p.x);
      maxTileY = Math.max(maxTileY, p.y);
    });

    const padding = 2 * this.tileSize;
    const contentWidth = (maxTileX - minTileX + 1) * this.tileSize;
    const contentHeight = (maxTileY - minTileY + 1) * this.tileSize;
    const viewportW = this.scale.width;
    const viewportH = this.scale.height;

    this.worldOffsetX = Math.floor((viewportW - contentWidth) / 2) -
      minTileX * this.tileSize;
    this.worldOffsetY = Math.floor((viewportH - contentHeight) / 2) -
      minTileY * this.tileSize;

    const worldMinX = this.tileToWorldX(minTileX) - padding;
    const worldMinY = this.tileToWorldY(minTileY) - padding;
    const worldMaxX = this.tileToWorldX(maxTileX + 1) + padding;
    const worldMaxY = this.tileToWorldY(maxTileY + 1) + padding;

    this.floorBounds = {
      minX: worldMinX,
      minY: worldMinY,
      width: worldMaxX - worldMinX,
      height: worldMaxY - worldMinY,
    };
  }

  worldToTileX(worldX) {
    return Math.floor((worldX - this.worldOffsetX) / this.tileSize);
  }

  worldToTileY(worldY) {
    return Math.floor((worldY - this.worldOffsetY) / this.tileSize);
  }

  tileKey(x, y) {
    return `${x},${y}`;
  }

  rebuildWalkableTiles(floor) {
    this.walkableTiles.clear();

    floor.rooms.forEach((room) => {
      for (let y = 0; y < room.h; y++) {
        for (let x = 0; x < room.w; x++) {
          if (room.maze[y][x].type === 'floor') {
            this.walkableTiles.add(this.tileKey(room.x + x, room.y + y));
          }
        }
      }
    });

    (floor.corridorTiles || []).forEach((tile) => {
      this.walkableTiles.add(this.tileKey(tile.x, tile.y));
    });

    floor.stairs.forEach((stair) => {
      this.walkableTiles.add(this.tileKey(stair.x, stair.y));
    });
  }

  isWalkableWorld(worldX, worldY) {
    const tx = this.worldToTileX(worldX);
    const ty = this.worldToTileY(worldY);
    return this.walkableTiles.has(this.tileKey(tx, ty));
  }

  /** Check if entire player circle (radius r) at (worldX, worldY) is in walkable space. */
  isCircleWalkable(worldX, worldY, radius, floor) {
    const r = radius;
    const points = [
      { x: worldX, y: worldY },
      { x: worldX + r, y: worldY },
      { x: worldX - r, y: worldY },
      { x: worldX, y: worldY + r },
      { x: worldX, y: worldY - r },
    ];
    for (const p of points) {
      if (!this.isWalkableWorld(p.x, p.y)) return false;
    }
    // Same room: ensure edges between center and offset points are open.
    const centerTx = this.worldToTileX(worldX);
    const centerTy = this.worldToTileY(worldY);
    const centerRoom = this.getRoomAtTile(floor, centerTx, centerTy);
    if (!centerRoom) return true; // corridor - walkability is enough

    const openEdges = new Set(centerRoom.openEdges || []);
    const centerLocalX = centerTx - centerRoom.x;
    const centerLocalY = centerTy - centerRoom.y;

    for (const p of points) {
      if (p.x === worldX && p.y === worldY) continue;
      const ptTx = this.worldToTileX(p.x);
      const ptTy = this.worldToTileY(p.y);
      if (ptTx === centerTx && ptTy === centerTy) continue;
      const ptRoom = this.getRoomAtTile(floor, ptTx, ptTy);
      if (ptRoom !== centerRoom) continue;
      const ptLocalX = ptTx - centerRoom.x;
      const ptLocalY = ptTy - centerRoom.y;
      if (!this.isRoomEdgeOpen(openEdges, centerLocalX, centerLocalY, ptLocalX, ptLocalY)) {
        return false;
      }
    }
    return true;
  }

  roomEdgeKey(ax, ay, bx, by) {
    const a = `${ax},${ay}`;
    const b = `${bx},${by}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  isRoomEdgeOpen(openEdges, ax, ay, bx, by) {
    return openEdges.has(this.roomEdgeKey(ax, ay, bx, by));
  }

  getRoomAtTile(floor, tx, ty) {
    for (const room of floor.rooms) {
      if (
        tx >= room.x && tx < room.x + room.w && ty >= room.y &&
        ty < room.y + room.h
      ) {
        return room;
      }
    }
    return null;
  }

  canMoveWorld(fromWorldX, fromWorldY, toWorldX, toWorldY, floor) {
    if (!this.isCircleWalkable(toWorldX, toWorldY, this.playerRadius, floor)) return false;

    const fromTileX = this.worldToTileX(fromWorldX);
    const fromTileY = this.worldToTileY(fromWorldY);
    const toTileX = this.worldToTileX(toWorldX);
    const toTileY = this.worldToTileY(toWorldY);

    const dx = toTileX - fromTileX;
    const dy = toTileY - fromTileY;
    if (dx === 0 && dy === 0) return true;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;

    const fromRoom = this.getRoomAtTile(floor, fromTileX, fromTileY);
    const toRoom = this.getRoomAtTile(floor, toTileX, toTileY);

    // Corridor/outside-room transitions are allowed by tile walkability.
    if (!fromRoom || !toRoom || fromRoom !== toRoom) return true;

    const openEdges = new Set(fromRoom.openEdges || []);
    const fromLocalX = fromTileX - fromRoom.x;
    const fromLocalY = fromTileY - fromRoom.y;
    const toLocalX = toTileX - fromRoom.x;
    const toLocalY = toTileY - fromRoom.y;
    return this.isRoomEdgeOpen(
      openEdges,
      fromLocalX,
      fromLocalY,
      toLocalX,
      toLocalY,
    );
  }

  findFallbackSpawnTile(floor) {
    for (const room of floor.rooms) {
      for (let y = 0; y < room.h; y++) {
        for (let x = 0; x < room.w; x++) {
          if (room.maze[y][x].type === 'floor') {
            return { x: room.x + x, y: room.y + y };
          }
        }
      }
    }

    if (floor.corridorTiles && floor.corridorTiles.length > 0) {
      return floor.corridorTiles[0];
    }

    const firstRoom = floor.rooms[0] || { x: 0, y: 0, w: 1, h: 1 };
    return {
      x: firstRoom.x + Math.floor(firstRoom.w / 2),
      y: firstRoom.y + Math.floor(firstRoom.h / 2),
    };
  }

  resetForFreshDungeonRun() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    if (this.graphics) {
      this.graphics.clear();
      this.graphics.destroy();
      this.graphics = null;
    }
    if (this.floorText) {
      this.floorText.destroy();
      this.floorText = null;
    }
    if (this.stairPrompt) {
      this.stairPrompt.destroy();
      this.stairPrompt = null;
    }
    if (this.exitPrompt) {
      this.exitPrompt.destroy();
      this.exitPrompt = null;
    }
    this.destroyDecorTexts();
    this.lastStairDir = null;
    this.nearStair = null;
    this.nearExit = false;
    this.walkableTiles.clear();
  }
}

globalThis.Dungeons = Dungeons;
