// inventory.js
class Inventory extends Phaser.Scene {
  constructor() {
    super('Inventory');
  }

  preload() {
    this.load.image('background', './assets/game_background_3.1.png');
  }

  create() {
    // menu background
    this.background = this.add.image(0, 0, 'background').setOrigin(0, 0);
    this.background.setDisplaySize(800, 600);

    this.add.text(400, 80, 'INVENTORY', {
      fontSize: '48px',
      fill: '#fff',
    }).setOrigin(0.5);

    // Back button
    const backButton = this.add.text(400, 500, 'BACK TO PLAY', {
      fontSize: '24px',
      fill: '#fff',
      backgroundColor: '#333',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive();

    backButton.on('pointerdown', () => {
      this.scene.start('Play');
    });
  }
}

globalThis.Inventory = Inventory;
