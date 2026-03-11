// dungeon.js

class Dungeons extends Phaser.Scene {
  constructor() {
    super('Dungeons');

    // player stuff
    this.player = null;
    this.speed = 1;
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
    this.roomLabelTexts = [];
    this.currentRoom = null;
    this.currentRoomText = null;
    this.enemies = [];
    this.activatedRooms = new Set();
    this.enemyWanderSpeed = 0.35;
    this.enemyChaseSpeed = 0.6;
    this.enemyDetectionRange = 140;
    this.exploredOverlay = null;
    this.lanternGlow = null;
    this.lanternMaskKey = 'lantern-mask';
    this.exploredMaskKey = 'explored-mask';
    this.lanternRadius = 50;
    this.lanternSoftness = 15;
    this.darknessColor = 0x000000;
    this.exploredDarknessAlpha = 1;
    this.lanternOffsetX = 0;
    this.lanternOffsetY = 0;
    this.lanternMaskSize = 0;
  }

  create() {
    this.resetForFreshDungeonRun();
    this.ensureLanternMaskTexture();

    // generate the dungeon
    this.dungeon = generateDungeon();
    console.log('Dungeon made:', this.dungeon);

    // set up keyboard (WASD)
    this.keys = this.input.keyboard.addKeys({
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
    this.syncLantern();
    this.refreshDebugState();
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
    this.destroyRoomLabels();
    this.destroyEnemies();

    // calculate floor offset/bounds before drawing
    this.computeFloorLayout(floor);

    // draw everything
    this.drawFloor(floor);
    this.rebuildWalkableTiles(floor);
    this.createEnemiesForFloor(floor);

    this.createLanternOverlay();

    // place player
    if (!this.player) {
      // first time - find start room
      const startRoom = floor.rooms.find((r) => r.isStart);
      if (startRoom && startRoom.startPos) {
        this.player = this.add.circle(
          this.tileCenterX(startRoom.startPos.x),
          this.tileCenterY(startRoom.startPos.y),
          8,
          0x9dff8a,
        );
        this.player.setDepth(20);
      } else {
        const fallback = this.findFallbackSpawnTile(floor);
        this.player = this.add.circle(
          this.tileCenterX(fallback.x),
          this.tileCenterY(fallback.y),
          8,
          0x9dff8a,
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
    this.floorText.setDepth(1100);

    if (this.currentRoomText) this.currentRoomText.destroy();
    this.currentRoomText = this.add.text(20, 20, 'Room: Corridor', {
      fontSize: '20px',
      fill: '#fff',
    });
    this.currentRoomText.setScrollFactor(0);
    this.currentRoomText.setDepth(1100);

    this.resetExploredOverlay();
    this.updateCurrentRoom(true);
    this.syncLantern();
    this.refreshDebugState();
  }

  drawFloor(floor) {
    const size = this.tileSize; // size of each tile in pixels
    this.cameras.main.setBackgroundColor('#050505');

    // draw rooms
    floor.rooms.forEach((room) => {
      // draw room outline
      this.graphics.lineStyle(2, 0x7a7a7a, 0.95);
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

          // floor vs wall
          if (tile.type === 'floor') {
            this.graphics.fillStyle(0xc94a4a, 1);
            this.graphics.fillRect(worldX, worldY, size - 1, size - 1);
          } else {
            this.graphics.fillStyle(0x666666, 1);
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
      this.graphics.lineStyle(3, 0xffde59, 1);
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

      const roomLabel = this.add.text(
        this.tileCenterX(room.x + Math.floor(room.w / 2)),
        this.tileCenterY(room.y),
        room.roomLabel || `Room ${room.id}`,
        {
          fontSize: '12px',
          fill: '#fff7a8',
          backgroundColor: '#000000',
          padding: { x: 3, y: 1 },
        },
      ).setOrigin(0.5, 0);
      this.roomLabelTexts.push(roomLabel);
    });

    // draw paths
    const corridorTiles = floor.corridorTiles || [];
    corridorTiles.forEach((tile) => {
      const wx = this.tileToWorldX(tile.x);
      const wy = this.tileToWorldY(tile.y);
      this.graphics.fillStyle(0x7a7a7a, 1);
      this.graphics.fillRect(wx, wy, size - 1, size - 1);
    });

    // draw stairs
    floor.stairs.forEach((stair) => {
      const sx = this.tileToWorldX(stair.x);
      const sy = this.tileToWorldY(stair.y);

      // stair color (green for up, orange for down)
      this.graphics.fillStyle(stair.dir === 'up' ? 0x35c26b : 0xd98b2b, 1);
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
          fill: '#8cf7ff',
          backgroundColor: '#102126',
          padding: { x: 3, y: 2 },
        },
      ).setOrigin(0.5);
      this.floorDecorTexts.push(exitText);
    }
  }

  update() {
    if (!this.player) return;
    const floor = this.dungeon.floors[this.currentFloor];

    // movement (WASD)
    let dx = 0, dy = 0;
    if (this.keys.w.isDown) dy = -1;
    if (this.keys.s.isDown) dy = 1;
    if (this.keys.a.isDown) dx = -1;
    if (this.keys.d.isDown) dx = 1;

    // normalize diagonal
    if (dx !== 0 && dy !== 0) {
      dx *= 0.7;
      dy *= 0.7;
    }

    const desiredX = this.player.x + dx * this.speed;
    const desiredY = this.player.y + dy * this.speed;

    // Constrain player to walkable maze/corridor tiles.
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
    this.player.x = Phaser.Math.Clamp(
      this.player.x,
      this.floorBounds.minX + 8,
      this.floorBounds.minX + this.floorBounds.width - 8,
    );
    this.player.y = Phaser.Math.Clamp(
      this.player.y,
      this.floorBounds.minY + 8,
      this.floorBounds.minY + this.floorBounds.height - 8,
    );

    // check stairs
    this.checkStairs();

    // check exit (end room)
    this.checkExit();
    this.updateCurrentRoom();
    this.updateEnemies(floor);

    // check E key for stairs/exit
    if (Phaser.Input.Keyboard.JustDown(this.keys.e)) {
      if (this.nearExit) {
        this.scene.start('Play');
      } else if (this.nearStair) {
        this.useStairs(this.nearStair);
      }
    }

    this.syncLantern();
    this.refreshDebugState();
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
        this.stairPrompt.setDepth(1100);
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
          this.exitPrompt.setDepth(1100);
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

  destroyRoomLabels() {
    this.roomLabelTexts.forEach((textObj) => textObj.destroy());
    this.roomLabelTexts = [];
  }

  destroyEnemies() {
    this.enemies.forEach((enemy) => enemy.sprite.destroy());
    this.enemies = [];
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

  updateCurrentRoom(force = false) {
    if (!this.player || !this.dungeon) return;

    const floor = this.dungeon.floors[this.currentFloor];
    const room = this.getRoomAtTile(
      floor,
      this.worldToTileX(this.player.x),
      this.worldToTileY(this.player.y),
    );
    const nextRoomId = room?.id ?? null;

    if (!force && this.currentRoom?.id === nextRoomId) return;

    this.currentRoom = room
      ? {
        id: room.id,
        index: room.roomIndex ?? null,
        label: room.roomLabel ?? room.id,
      }
      : null;

    if (this.currentRoom?.id) {
      this.activatedRooms.add(this.currentRoom.id);
    }

    if (this.currentRoomText) {
      this.currentRoomText.setText(
        this.currentRoom ? `Room: ${this.currentRoom.label}` : 'Room: Corridor',
      );
    }
  }

  canMoveWorld(fromWorldX, fromWorldY, toWorldX, toWorldY, floor) {
    if (!this.isWalkableWorld(toWorldX, toWorldY)) return false;

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

  createEnemiesForFloor(floor) {
    this.enemies = [];

    floor.rooms.forEach((room) => {
      (room.enemies || []).forEach((enemyData, index) => {
        const sprite = this.add.circle(
          this.tileCenterX(enemyData.x),
          this.tileCenterY(enemyData.y),
          7,
          0xb84dff,
        );
        sprite.setDepth(19);

        this.enemies.push({
          id: enemyData.id ?? `${room.id}-enemy-${index}`,
          roomId: room.id,
          roomIndex: room.roomIndex ?? null,
          sprite,
          homeTileX: enemyData.x,
          homeTileY: enemyData.y,
          wanderTargetTile: { x: enemyData.x, y: enemyData.y },
          path: [],
          pathTargetKey: null,
        });
      });
    });
  }

  updateEnemies(floor) {
    this.enemies.forEach((enemy) => {
      const room = floor.rooms.find((candidate) => candidate.id === enemy.roomId);
      if (!room) return;

      const playerInRoom = this.currentRoom?.id === room.id;
      const roomActivated = this.activatedRooms.has(room.id);

      if (!roomActivated) {
        enemy.sprite.setPosition(
          this.tileCenterX(enemy.homeTileX),
          this.tileCenterY(enemy.homeTileY),
        );
        enemy.path = [];
        enemy.pathTargetKey = null;
        enemy.wanderTargetTile = { x: enemy.homeTileX, y: enemy.homeTileY };
        return;
      }

      const enemyTileX = this.worldToTileX(enemy.sprite.x);
      const enemyTileY = this.worldToTileY(enemy.sprite.y);

      let targetTile = null;
      let speed = this.enemyWanderSpeed;

      if (roomActivated && playerInRoom) {
        const distance = Phaser.Math.Distance.Between(
          enemy.sprite.x,
          enemy.sprite.y,
          this.player.x,
          this.player.y,
        );
        if (distance <= this.enemyDetectionRange) {
          targetTile = {
            x: this.worldToTileX(this.player.x),
            y: this.worldToTileY(this.player.y),
          };
          speed = this.enemyChaseSpeed;
        }
      }

      if (!targetTile) {
        const targetReached =
          enemyTileX === enemy.wanderTargetTile.x &&
          enemyTileY === enemy.wanderTargetTile.y;
        if (targetReached) {
          enemy.wanderTargetTile = this.pickEnemyWanderTile(room, enemy);
        }
        targetTile = enemy.wanderTargetTile;
      }

      this.moveEnemyTowardTileWithAStar(enemy, room, targetTile, speed);
    });
  }

  pickEnemyWanderTile(room, enemy) {
    const candidates = [];
    for (let y = 0; y < room.h; y++) {
      for (let x = 0; x < room.w; x++) {
        if (room.maze[y][x].type === 'floor') {
          candidates.push({ x: room.x + x, y: room.y + y });
        }
      }
    }

    if (candidates.length === 0) {
      return { x: enemy.homeTileX, y: enemy.homeTileY };
    }

    const currentTileX = this.worldToTileX(enemy.sprite.x);
    const currentTileY = this.worldToTileY(enemy.sprite.y);
    const filtered = candidates.filter((tile) =>
      tile.x !== currentTileX || tile.y !== currentTileY
    );
    const pool = filtered.length > 0 ? filtered : candidates;
    return Phaser.Utils.Array.GetRandom(pool);
  }

  moveEnemyTowardTileWithAStar(enemy, room, targetTile, speed) {
    const startTile = {
      x: this.worldToTileX(enemy.sprite.x),
      y: this.worldToTileY(enemy.sprite.y),
    };
    const targetKey = this.tileKey(targetTile.x, targetTile.y);

    if (
      !enemy.path ||
      enemy.path.length === 0 ||
      enemy.pathTargetKey !== targetKey ||
      enemy.path[enemy.path.length - 1]?.x !== targetTile.x ||
      enemy.path[enemy.path.length - 1]?.y !== targetTile.y
    ) {
      enemy.path = this.findPathWithinRoom(room, startTile, targetTile);
      enemy.pathTargetKey = targetKey;
    }

    if (!enemy.path || enemy.path.length === 0) return;

    while (
      enemy.path.length > 0 &&
      enemy.path[0].x === startTile.x &&
      enemy.path[0].y === startTile.y
    ) {
      enemy.path.shift();
    }

    if (enemy.path.length === 0) return;

    const nextTile = enemy.path[0];
    const targetX = this.tileCenterX(nextTile.x);
    const targetY = this.tileCenterY(nextTile.y);
    const dx = targetX - enemy.sprite.x;
    const dy = targetY - enemy.sprite.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= speed) {
      enemy.sprite.x = targetX;
      enemy.sprite.y = targetY;
      enemy.path.shift();
      return;
    }

    enemy.sprite.x += (dx / distance) * speed;
    enemy.sprite.y += (dy / distance) * speed;
  }

  findPathWithinRoom(room, startTile, goalTile) {
    if (
      startTile.x === goalTile.x &&
      startTile.y === goalTile.y
    ) {
      return [];
    }

    const openSet = [startTile];
    const cameFrom = new Map();
    const gScore = new Map([[this.tileKey(startTile.x, startTile.y), 0]]);
    const fScore = new Map([[
      this.tileKey(startTile.x, startTile.y),
      this.heuristicCost(startTile, goalTile),
    ]]);
    const openKeys = new Set([this.tileKey(startTile.x, startTile.y)]);

    while (openSet.length > 0) {
      openSet.sort((a, b) =>
        (fScore.get(this.tileKey(a.x, a.y)) ?? Number.POSITIVE_INFINITY) -
        (fScore.get(this.tileKey(b.x, b.y)) ?? Number.POSITIVE_INFINITY)
      );
      const current = openSet.shift();
      const currentKey = this.tileKey(current.x, current.y);
      openKeys.delete(currentKey);

      if (current.x === goalTile.x && current.y === goalTile.y) {
        return this.reconstructTilePath(cameFrom, current);
      }

      this.getRoomNeighbors(room, current).forEach((neighbor) => {
        const neighborKey = this.tileKey(neighbor.x, neighbor.y);
        const tentativeG =
          (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;

        if (tentativeG >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
          return;
        }

        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(
          neighborKey,
          tentativeG + this.heuristicCost(neighbor, goalTile),
        );

        if (!openKeys.has(neighborKey)) {
          openSet.push(neighbor);
          openKeys.add(neighborKey);
        }
      });
    }

    return [];
  }

  reconstructTilePath(cameFrom, current) {
    const path = [current];
    let currentKey = this.tileKey(current.x, current.y);

    while (cameFrom.has(currentKey)) {
      const previous = cameFrom.get(currentKey);
      path.unshift(previous);
      currentKey = this.tileKey(previous.x, previous.y);
    }

    return path;
  }

  heuristicCost(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  getRoomNeighbors(room, tile) {
    const neighbors = [];
    const localX = tile.x - room.x;
    const localY = tile.y - room.y;
    const openEdges = new Set(room.openEdges || []);
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    directions.forEach((direction) => {
      const nextLocalX = localX + direction.dx;
      const nextLocalY = localY + direction.dy;
      if (
        nextLocalX < 0 || nextLocalX >= room.w ||
        nextLocalY < 0 || nextLocalY >= room.h
      ) {
        return;
      }

      if (room.maze[nextLocalY][nextLocalX]?.type !== 'floor') return;
      if (!this.isRoomEdgeOpen(openEdges, localX, localY, nextLocalX, nextLocalY)) {
        return;
      }

      neighbors.push({
        x: room.x + nextLocalX,
        y: room.y + nextLocalY,
      });
    });

    return neighbors;
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

  ensureLanternMaskTexture() {
    if (this.textures.exists(this.lanternMaskKey)) return;

    const radius = this.lanternRadius;
    const softness = this.lanternSoftness;
    const size = (radius + softness) * 2;
    this.lanternMaskSize = size;
    const canvasTexture = this.textures.createCanvas(
      this.lanternMaskKey,
      size,
      size,
    );
    const context = canvasTexture.context;
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      radius * 0.2,
      size / 2,
      size / 2,
      radius + softness,
    );

    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.45, 'rgba(255, 245, 210, 0.95)');
    gradient.addColorStop(0.75, 'rgba(255, 215, 140, 0.45)');
    gradient.addColorStop(1, 'rgba(255, 180, 80, 0)');

    context.clearRect(0, 0, size, size);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
    canvasTexture.refresh();

    const exploredTexture = this.textures.createCanvas(
      this.exploredMaskKey,
      size,
      size,
    );
    const exploredContext = exploredTexture.context;
    const exploredGradient = exploredContext.createRadialGradient(
      size / 2,
      size / 2,
      radius * 0.15,
      size / 2,
      size / 2,
      radius + softness,
    );

    exploredGradient.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    exploredGradient.addColorStop(0.5, 'rgba(255, 245, 210, 0.12)');
    exploredGradient.addColorStop(0.8, 'rgba(255, 210, 120, 0.05)');
    exploredGradient.addColorStop(1, 'rgba(255, 180, 80, 0)');

    exploredContext.clearRect(0, 0, size, size);
    exploredContext.fillStyle = exploredGradient;
    exploredContext.fillRect(0, 0, size, size);
    exploredTexture.refresh();
  }

  createLanternOverlay() {
    if (this.exploredOverlay) {
      this.exploredOverlay.destroy();
    }
    if (this.lanternGlow) {
      this.lanternGlow.destroy();
    }

    this.lanternGlow = this.add.image(0, 0, this.lanternMaskKey);
    this.lanternGlow.setDepth(1001);
    this.lanternGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.lanternGlow.setAlpha(0.18);
    this.lanternGlow.setScale(0.7);

    this.exploredOverlay = this.add.renderTexture(
      this.floorBounds.minX,
      this.floorBounds.minY,
      this.floorBounds.width,
      this.floorBounds.height,
    );
    this.exploredOverlay.setOrigin(0, 0);
    this.exploredOverlay.setDepth(1000);
    this.resetExploredOverlay();
  }

  resetExploredOverlay() {
    if (!this.exploredOverlay) return;
    this.exploredOverlay.clear();
    this.exploredOverlay.fill(this.darknessColor, this.exploredDarknessAlpha);
  }

  syncLantern() {
    if (!this.player || !this.lanternGlow) return;

    const playerWorldX = this.player.x + this.lanternOffsetX;
    const playerWorldY = this.player.y + this.lanternOffsetY;
    const eraseX =
      playerWorldX - this.floorBounds.minX - this.lanternMaskSize / 2;
    const eraseY =
      playerWorldY - this.floorBounds.minY - this.lanternMaskSize / 2;

    if (this.exploredOverlay) {
      this.exploredOverlay.erase(this.exploredMaskKey, eraseX, eraseY);
    }
    this.lanternGlow.setPosition(playerWorldX, playerWorldY);
  }

  refreshDebugState() {
    const payload = {
      scene: this.scene.key,
      floor: this.currentFloor + 1,
      totalFloors: this.dungeon?.totalFloors ?? 0,
      player: this.player
        ? {
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
          tileX: this.worldToTileX(this.player.x),
          tileY: this.worldToTileY(this.player.y),
        }
        : null,
      prompts: {
        nearStair: Boolean(this.nearStair),
        nearExit: Boolean(this.nearExit),
      },
      currentRoom: this.currentRoom,
      enemies: this.enemies.map((enemy) => ({
        id: enemy.id,
        roomId: enemy.roomId,
        x: Math.round(enemy.sprite.x),
        y: Math.round(enemy.sprite.y),
      })),
      coordinateSystem: 'origin top-left, +x right, +y down',
    };

    globalThis.__DUNGEON_DEBUG_STATE__ = payload;
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
    if (this.currentRoomText) {
      this.currentRoomText.destroy();
      this.currentRoomText = null;
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
    this.destroyRoomLabels();
    this.destroyEnemies();
    if (this.exploredOverlay) {
      this.exploredOverlay.destroy();
      this.exploredOverlay = null;
    }
    if (this.lanternGlow) {
      this.lanternGlow.destroy();
      this.lanternGlow = null;
    }
    this.lastStairDir = null;
    this.activatedRooms.clear();
    this.currentRoom = null;
    this.nearStair = null;
    this.nearExit = false;
    this.walkableTiles.clear();
  }
}

globalThis.Dungeons = Dungeons;
