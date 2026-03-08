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
