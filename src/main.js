import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth || 1280,
  height: window.innerHeight || 720,
  backgroundColor: '#0d0f18',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  fps: {
    target: 60,
    forceSetTimeOut: false
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [BootScene, MenuScene, GameScene]
};

const game = new Phaser.Game(config);
window.__HABEY_GAME__ = game;

export default game;
