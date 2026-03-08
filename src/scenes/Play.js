class Play extends Phaser.Scene {
  constructor() {
    super('Play');

    // player data
    this.playerName = 'Adventurer';
    this.editingName = false;
    this.nameInput = '';
  }

  preload() {
    this.load.image('playBackground', './assets/character.png');
    // save icon?
  }

  create() {
    // background
    this.background = this.add.image(0, 0, 'playBackground').setOrigin(0, 0);
    this.background.setDisplaySize(800, 600);

    // vertical divider line
    const divider = this.add.line(400, 0, 0, 0, 0, 600, 0xffffff, 0.5);
    divider.setLineWidth(2);

    // left half 0 - 400px
    this.createLeftHalf();

    // right half 400 - 800px
    this.createRightHalf();
  }

  createLeftHalf() {
    // player name - click to edit
    this.playerNameText = this.add.text(200, 80, this.playerName, {
      fontSize: '28px',
      fill: '#fff',
      backgroundColor: '#333',
      padding: { x: 15, y: 8 },
      fixedWidth: 250,
      align: 'center',
    }).setOrigin(0.5).setInteractive();

    // name editing function
    this.playerNameText.on('pointerdown', () => {
      this.startNameEditing();
    });

    // player
    this.add.rectangle(200, 220, 100, 100, 0x444444, 0.3);
    this.add.text(200, 220, 'PLAYER', {
      fontSize: '16px',
      fill: '#fff',
    }).setOrigin(0.5);

    // back to menu
    const backButton = this.add.text(100, 550, '← BACK TO MENU', {
      fontSize: '20px',
      fill: '#fff',
      backgroundColor: '#333',
      padding: { x: 10, y: 5 },
    }).setInteractive();

    backButton.on('pointerdown', () => {
      this.scene.start('Menu');
    });

    // save button
    const saveButton = this.add.text(300, 550, '💾 SAVE', {
      fontSize: '20px',
      fill: '#0f0',
      backgroundColor: '#333',
      padding: { x: 15, y: 5 },
    }).setInteractive();

    saveButton.on('pointerdown', () => {
      this.openSaveMenu();
    });

    // Player stats display (for context)
    this.add.text(100, 320, 'STATS:', {
      fontSize: '18px',
      fill: '#fff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(100, 350, `Level: ${gameState.player.level}`, {
      fontSize: '16px',
      fill: '#fff',
    }).setOrigin(0.5);

    this.add.text(
      100,
      375,
      `HP: ${gameState.player.hp}/${gameState.player.maxHP}`,
      {
        fontSize: '16px',
        fill: '#f00',
      },
    ).setOrigin(0.5);

    this.add.text(100, 400, `ATK: ${gameState.player.atk}`, {
      fontSize: '16px',
      fill: '#ff0',
    }).setOrigin(0.5);
  }

  createRightHalf() {
    // title
    this.add.text(600, 80, 'ACTIONS', {
      fontSize: '32px',
      fill: '#fff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // inventory button
    const inventoryBtn = this.add.text(600, 200, 'INVENTORY', {
      fontSize: '28px',
      fill: '#ff0',
      backgroundColor: '#444',
      padding: { x: 25, y: 12 },
      fixedWidth: 200,
      align: 'center',
    }).setOrigin(0.5).setInteractive();

    inventoryBtn.on('pointerdown', () => {
      this.scene.start('Inventory');
    });

    // upgrades button
    const upgradesBtn = this.add.text(600, 300, 'UPGRADES', {
      fontSize: '28px',
      fill: '#0ff',
      backgroundColor: '#444',
      padding: { x: 25, y: 12 },
      fixedWidth: 200,
      align: 'center',
    }).setOrigin(0.5).setInteractive();

    upgradesBtn.on('pointerdown', () => {
      this.scene.start('Upgrades');
    });

    // dungeon button
    const dungeonBtn = this.add.text(600, 400, 'DUNGEON', {
      fontSize: '28px',
      fill: '#f0f',
      backgroundColor: '#444',
      padding: { x: 25, y: 12 },
      fixedWidth: 200,
      align: 'center',
    }).setOrigin(0.5).setInteractive();

    dungeonBtn.on('pointerdown', () => {
      this.scene.start('Dungeons');
    });
  }

  startNameEditing() {
    this.editingName = true;
    this.nameInput = this.playerName;

    // input prompt
    const promptBg = this.add.rectangle(400, 300, 400, 200, 0x000000, 0.9);
    const promptText = this.add.text(400, 250, 'Enter new name:', {
      fontSize: '24px',
      fill: '#fff',
    }).setOrigin(0.5);

    // field background
    const inputBg = this.add.rectangle(400, 320, 300, 40, 0x333333);

    // input text
    this.nameInputText = this.add.text(400, 320, this.playerName, {
      fontSize: '20px',
      fill: '#0f0',
    }).setOrigin(0.5);

    // save button
    const saveNameBtn = this.add.text(350, 380, 'SAVE', {
      fontSize: '20px',
      fill: '#0f0',
      backgroundColor: '#333',
      padding: { x: 15, y: 5 },
    }).setInteractive();

    // cancel button
    const cancelBtn = this.add.text(450, 380, 'CANCEL', {
      fontSize: '20px',
      fill: '#f00',
      backgroundColor: '#333',
      padding: { x: 15, y: 5 },
    }).setInteractive();

    // store elements
    this.nameEditElements = [
      promptBg,
      promptText,
      inputBg,
      this.nameInputText,
      saveNameBtn,
      cancelBtn,
    ];

    // keyboard input
    this.input.keyboard.on('keydown', this.handleNameInput, this);

    saveNameBtn.on('pointerdown', () => {
      this.saveNewName();
    });

    cancelBtn.on('pointerdown', () => {
      this.cancelNameEditing();
    });
  }

  handleNameInput(event) {
    if (!this.editingName) return;

    if (event.key === 'Enter') {
      this.saveNewName();
    } else if (event.key === 'Escape') {
      this.cancelNameEditing();
    } else if (event.key === 'Backspace') {
      this.nameInput = this.nameInput.slice(0, -1);
    } else if (event.key.length === 1 && this.nameInput.length < 20) {
      this.nameInput += event.key;
    }

    if (this.nameInputText) {
      this.nameInputText.setText(this.nameInput || ' ');
    }
  }

  saveNewName() {
    if (this.nameInput.trim()) {
      this.playerName = this.nameInput.trim();
      this.playerNameText.setText(this.playerName);
    }
    this.cancelNameEditing();
  }

  cancelNameEditing() {
    this.editingName = false;
    this.input.keyboard.off('keydown', this.handleNameInput, this);

    if (this.nameEditElements) {
      this.nameEditElements.forEach((el) => el.destroy());
    }
    this.nameEditElements = null;
    this.nameInputText = null;
  }

  openSaveMenu() {
    // pause play scene
    this.scene.launch('Saves', {
      mode: 'save',
      playerName: this.playerName,
      playerStats: gameState.player,
      returnScene: 'Play',
    });
    this.scene.pause();
  }
}

globalThis.Play = Play;
