class Credits extends Phaser.Scene {
  constructor() {
    super('Credits');
  }

  preload() {
    this.load.image('background', './assets/game_background_3.1.png');
  }

  create() {
    // menu background
    this.background = this.add.image(0, 0, 'background').setOrigin(0, 0);
    this.background.setDisplaySize(800, 600);

    // Scene title
    this.add.text(400, 80, 'CREDITS', {
      fontSize: '48px',
      fill: '#fff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // add credits - character.png and download.gif from mini-moss.tumblr.com/
    // game background png from https://craftpix.net/freebies/free-horizontal-2d-game-backgrounds/
    // lootbox.py from https://github.com/TristanChenUCSC/Lootbox-Generator

    // Back button to menu
    const backButton = this.add.text(100, 550, '← BACK TO MENU', {
      fontSize: '24px',
      fill: '#fff',
      backgroundColor: '#333',
      padding: { x: 15, y: 8 },
    }).setInteractive();

    backButton.on('pointerdown', () => {
      this.scene.start('Menu');
    });
  }
}

globalThis.Credits = Credits;
