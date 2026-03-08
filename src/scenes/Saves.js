class Saves extends Phaser.Scene {
  constructor() {
    super('Saves');
    this.saves = [];
    this.mode = 'load';
    this.returnScene = 'Menu';
  }

  init(data) {
    this.mode = data.mode || 'load';
    this.playerName = data.playerName || 'Adventurer';
    this.playerStats = data.playerStats || null;
    this.returnScene = data.returnScene || 'Menu';
  }

  preload() {
    this.load.image('background', './assets/game_background_3.1.png');
  }

  create() {
    // menu background
    this.background = this.add.image(0, 0, 'background').setOrigin(0, 0);
    this.background.setDisplaySize(800, 600);

    // Scene title
    this.add.text(400, 80, 'LOAD SAVES', {
      fontSize: '48px',
      fill: '#fff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // back button
    const backButton = this.add.text(400, 500, '← BACK', {
      fontSize: '24px',
      fill: '#fff',
      backgroundColor: '#333',
      padding: { x: 15, y: 8 },
    }).setInteractive();

    backButton.on('pointerdown', () => {
      if (this.returnScene === 'Play') {
        this.scene.resume('Play');
        this.scene.stop();
      } else {
        this.scene.start('Menu');
      }
    });
  }
}

globalThis.Saves = Saves;
