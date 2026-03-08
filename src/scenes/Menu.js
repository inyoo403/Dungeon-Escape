class Menu extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  preload() {
    this.load.image('background', './assets/game_background_3.1.png');
  }

  create() {
    // menu background
    this.background = this.add.image(0, 0, 'background').setOrigin(0, 0);
    this.background.setDisplaySize(800, 600);

    // title
    this.add.text(400, 80, 'DUNGEON ESCAPE', {
      fontSize: '48px',
      fill: '#fff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // interactive play button
    const playButton = this.add.text(400, 200, 'PLAY', {
      fontSize: '32px',
      fill: '#0f0',
      backgroundColor: '#333',
      padding: { x: 30, y: 15 },
    }).setOrigin(0.5).setInteractive();

    playButton.on('pointerdown', () => {
      this.scene.start('Play');
    });

    // instructions button
    const instructionsButton = this.add.text(400, 300, 'INSTRUCTIONS', {
      fontSize: '32px',
      fill: '#ff0',
      backgroundColor: '#333',
      padding: { x: 30, y: 15 },
    }).setOrigin(0.5).setInteractive();

    instructionsButton.on('pointerdown', () => {
      this.scene.start('Instructions');
    });

    // load saves button
    const loadSavesButton = this.add.text(250, 400, 'LOAD SAVES', {
      fontSize: '32px',
      fill: '#00f',
      backgroundColor: '#333',
      padding: { x: 30, y: 15 },
    }).setOrigin(0.5).setInteractive();

    loadSavesButton.on('pointerdown', () => {
      this.scene.start('Saves', {
        mode: 'load',
        returnScene: 'Menu',
      });
    });

    // credits button
    const creditsButton = this.add.text(550, 400, 'CREDITS', {
      fontSize: '32px',
      fill: '#f0f',
      backgroundColor: '#333',
      padding: { x: 30, y: 15 },
    }).setOrigin(0.5).setInteractive();

    creditsButton.on('pointerdown', () => {
      this.scene.start('Credits');
    });
  }
}

globalThis.Menu = Menu;
