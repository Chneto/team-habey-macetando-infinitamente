import Phaser from 'phaser';
import AssetManager from '../systems/AssetManager.js';
import AnimationSystem from '../systems/AnimationSystem.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    AssetManager.preload(this);
  }

  create() {
    AssetManager.ensureAllAssets(this);
    AnimationSystem.registerAllAnimations(this);
    this.scene.start('MenuScene');
  }
}

export default BootScene;
