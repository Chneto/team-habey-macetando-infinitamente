import Phaser from 'phaser';
import uiManager from '../ui/UIManager.js';
import saveManager from '../systems/SaveManager.js';
import soundManager from '../systems/SoundManager.js';
import a11yModalManager from '../ui/A11yModalManager.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.onStartRunBound = null;
  }

  create() {
    const menuScreen = document.getElementById('menu-screen');
    const hudScreen = document.getElementById('hud-screen');
    const bossVignette = document.getElementById('boss-vignette');

    if (menuScreen) menuScreen.classList.remove('hidden');
    if (hudScreen) hudScreen.classList.add('hidden');
    if (bossVignette) bossVignette.classList.add('hidden');

    uiManager.renderMainMenu();

    // Background atmospheric preview in Phaser canvas behind menu
    const { width, height } = this.scale;
    this.bgTile = this.add.tileSprite(0, 0, width, height, 'arcane_floor').setOrigin(0, 0);

    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
      startBtn.onclick = () => {
        soundManager.playButtonClick();
        this.startGameRun();
      };
    }

    const openShopBtn = document.getElementById('btn-open-shop');
    const closeShopBtn = document.getElementById('btn-close-shop');
    const shopModal = document.getElementById('shop-modal');
    if (openShopBtn && shopModal) {
      openShopBtn.onclick = () => {
        soundManager.playButtonClick();
        uiManager.renderTalentShop();
        a11yModalManager.open(shopModal, openShopBtn);
      };
    }
    if (closeShopBtn && shopModal) {
      closeShopBtn.onclick = () => {
        soundManager.playButtonClick();
        a11yModalManager.close(shopModal);
      };
    }

    const openGrimoireBtn = document.getElementById('btn-open-grimoire');
    const closeGrimoireBtn = document.getElementById('btn-close-grimoire');
    const grimoireModal = document.getElementById('grimoire-modal');
    if (openGrimoireBtn && grimoireModal) {
      openGrimoireBtn.onclick = () => {
        soundManager.playButtonClick();
        uiManager.renderGrimoire();
        a11yModalManager.open(grimoireModal, openGrimoireBtn);
      };
    }
    if (closeGrimoireBtn && grimoireModal) {
      closeGrimoireBtn.onclick = () => {
        soundManager.playButtonClick();
        a11yModalManager.close(grimoireModal);
      };
    }

    if (this.onStartRunBound) {
      window.removeEventListener('habey:start-run', this.onStartRunBound);
    }
    this.onStartRunBound = () => this.startGameRun();
    window.addEventListener('habey:start-run', this.onStartRunBound);

    const cleanup = () => {
      if (this.onStartRunBound) {
        window.removeEventListener('habey:start-run', this.onStartRunBound);
        this.onStartRunBound = null;
      }
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
  }

  update(_time, delta) {
    if (this.bgTile) {
      this.bgTile.tilePositionX += delta * 0.015;
      this.bgTile.tilePositionY += delta * 0.01;
    }
  }

  startGameRun() {
    if (this.onStartRunBound) {
      window.removeEventListener('habey:start-run', this.onStartRunBound);
      this.onStartRunBound = null;
    }
    const menuScreen = document.getElementById('menu-screen');
    if (menuScreen) menuScreen.classList.add('hidden');

    const selectedCharId = saveManager.getSelectedCharacterId();
    this.scene.start('GameScene', { characterId: selectedCharId });
  }
}

export default MenuScene;
