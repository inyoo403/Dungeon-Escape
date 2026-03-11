const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 800,
  height: 600,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600,
  },
  physics: {
    default: 'arcade',
    arcade: {
      // set to true when testing collisions
      debug: false,
    },
  },
  scene: [
    Menu,
    Instructions,
    Play,
    Inventory,
    Upgrades,
    Dungeons,
    Credits,
    Saves,
  ],
};

const game = new Phaser.Game(config);
globalThis.game = game;
globalThis.render_game_to_text = () =>
  JSON.stringify(globalThis.__DUNGEON_DEBUG_STATE__ ?? {
    scene: game.scene.getScenes(true)[0]?.scene?.key ?? 'unknown',
    coordinateSystem: 'origin top-left, +x right, +y down',
  });
globalThis.advanceTime = (ms = 16.67) => {
  if (!game.loop) return;
  const delta = Math.max(16.67, ms);
  game.step(Date.now(), delta);
};

// Game state
const gameState = {
  player: {
    level: 1,
    hp: 100,
    maxHP: 100,
    atk: 10,
    exp: 0,
    inventory: [],
    armor: null,
  },
  settings: {
    sound: true,
    music: true,
  },
};

globalThis.gameState = gameState;
