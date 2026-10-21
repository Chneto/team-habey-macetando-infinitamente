import Phaser from 'phaser';
import Player from '../entities/Player.js';
import GemManager from '../entities/GemManager.js';
import CombatSystem from '../systems/CombatSystem.js';
import SpawnSystem from '../systems/SpawnSystem.js';
import uiManager from '../ui/UIManager.js';
import DebugPanel from '../ui/DebugPanel.js';
import saveManager from '../systems/SaveManager.js';
import soundManager from '../systems/SoundManager.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    this.selectedCharacterId = data?.characterId || saveManager.getSelectedCharacterId() || 'petrus';
    this.runSeconds = 0;
    this.isTimerLockedByBoss = false;
    this.isPausedByDebug = false;
    this.isPausedByLevelUp = false;
    this.isGameOver = false;
    this.pendingLevelUps = 0;
    this.enemiesFrozenUntil = 0;
    this.joystickVec = { x: 0, y: 0 };
    this.hudTickTimer = 0;
  }

  create() {
    window.__HABEY_SCENE__ = this;

    const menuScreen = document.getElementById('menu-screen');
    const hudScreen = document.getElementById('hud-screen');
    const levelupModal = document.getElementById('levelup-modal');
    const debugModal = document.getElementById('debug-modal');
    const gameoverModal = document.getElementById('gameover-modal');

    if (menuScreen) menuScreen.classList.add('hidden');
    if (hudScreen) hudScreen.classList.remove('hidden');
    if (levelupModal) levelupModal.classList.add('hidden');
    if (debugModal) debugModal.classList.add('hidden');
    if (gameoverModal) gameoverModal.classList.add('hidden');

    // Infinite non-blocking Arcane Floor TileSprite
    const { width, height } = this.scale;
    this.floorTile = this.add
      .tileSprite(0, 0, width * 2, height * 2, 'arcane_floor')
      .setScrollFactor(0)
      .setDepth(0);

    // Non-colliding background props (ancient runes, fissures, low vegetation)
    this.groundProps = [];
    this.initGroundProps();
    this.bossAtmosphereActive = false;
    this.bossWeatherParticles = [];

    // Core Gameplay Systems & Entities
    this.player = new Player(this, 0, 0, this.selectedCharacterId);
    this.gemManager = new GemManager(this);
    this.combatSystem = new CombatSystem(this);
    this.spawnSystem = new SpawnSystem(this);
    this.spawnSystem.initStarterPets(this.player);

    // Camera smoothly follows Player on infinite plane with 1.18x cinematic zoom
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setZoom(1.18);

    // UI & Debug Panel
    this.uiManager = uiManager;
    uiManager.setGameScene(this);
    this.debugPanel = new DebugPanel(this);

    // Spawn 1 initial Chest & 1 Pet Cage at moderate distance so edge arrows are immediately visible
    this.spawnSystem.createTreasureChest(520, -340);
    this.spawnSystem.createPetCage(-540, 320);

    this.setupInputs();
    this.setBossAtmosphere(false, false);
    uiManager.updateHud();

    // Global Restart / Return to Menu listeners
    this.onRestartBound = () => {
      this.cleanupListeners();
      this.scene.restart({ characterId: saveManager.getSelectedCharacterId() });
    };
    this.onReturnMenuBound = () => {
      this.cleanupListeners();
      this.scene.start('MenuScene');
    };
    window.addEventListener('habey:start-run', this.onRestartBound);
    window.addEventListener('habey:return-menu', this.onReturnMenuBound);
    this.events.once('shutdown', () => this.cleanupListeners());
    this.events.once('destroy', () => this.cleanupListeners());
  }

  initGroundProps() {
    this.initEmittersAndDecalPool();
    for (let i = 0; i < 36; i++) {
      const px = (Math.random() - 0.5) * 2000;
      const py = (Math.random() - 0.5) * 1600;
      const kind = i % 3;
      let node;
      if (kind === 0) {
        // Ancient arcane floor rune with glowing border
        node = this.add.circle(px, py, 26, 0x8b5cf6, 0.10).setStrokeStyle(1.8, 0xa855f7, 0.35);
      } else if (kind === 1) {
        // Glowing magma/void fissure
        node = this.add.rectangle(px, py, 42, 3.5, 0xf97316, 0.38).setRotation((i * 0.65) % Math.PI);
      } else {
        // Arcane luminous vegetation/crystal cluster
        node = this.add.circle(px, py, 7, 0x10b981, 0.28).setStrokeStyle(1.2, 0x34d399, 0.45);
      }
      node.setDepth(1);
      this.groundProps.push(node);
    }
  }

  initEmittersAndDecalPool() {
    // 1. Pre-allocated Decal Pool to eliminate dynamic GameObject churn
    this.decalPool = [];
    this.decalPoolIndex = 0;
    for (let i = 0; i < 32; i++) {
      const d = this.add.ellipse(-9999, -9999, 28, 20, 0x450a0a, 0).setDepth(2);
      this.decalPool.push(d);
    }

    // 2. Persistent GPU Particle Emitters for zero Garbage Collection (GC) pauses
    if (this.add.particles) {
      try {
        this.ambientMoteEmitter = this.add.particles(0, 0, 'particle_spark', {
          speed: { min: 10, max: 25 },
          angle: { min: 250, max: 290 },
          scale: { start: 0.45, end: 0.1 },
          alpha: { start: 0.35, end: 0 },
          lifespan: { min: 1400, max: 2200 },
          frequency: 240,
          tint: [0x8b5cf6, 0x38bdf8],
          emitting: true,
          depth: 18
        });

        this.bossAtmosphereEmitter = this.add.particles(0, 0, 'particle_spark', {
          speedY: { min: 380, max: 620 },
          speedX: { min: -80, max: -30 },
          scale: { start: 0.65, end: 0.1 },
          alpha: { start: 0.55, end: 0 },
          lifespan: 900,
          frequency: 160,
          tint: 0xef4444,
          emitting: false,
          depth: 19
        });
      } catch (e) {
        console.warn('[GameScene] GPU Particle Emitter fallback enabled:', e);
      }
    }
  }

  updateGroundPropsAndWeather(_deltaMs) {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    for (const prop of this.groundProps) {
      const dx = prop.x - px;
      const dy = prop.y - py;
      if (dx < -1100) prop.x += 2200;
      else if (dx > 1100) prop.x -= 2200;
      if (dy < -900) prop.y += 1800;
      else if (dy > 900) prop.y -= 1800;
    }

    // Persistent Emitter Position Sync (Zero allocations per frame)
    if (this.ambientMoteEmitter) {
      this.ambientMoteEmitter.setPosition(
        px + (Math.random() - 0.5) * 800,
        py + (Math.random() - 0.5) * 600
      );
    }

    if (this.bossAtmosphereEmitter) {
      this.bossAtmosphereEmitter.setPosition(px + (Math.random() - 0.5) * 700, py - 360);
      this.bossAtmosphereEmitter.emitting = Boolean(this.bossAtmosphereActive);
      if (this.isTimerLockedByBoss) {
        this.bossAtmosphereEmitter.setParticleTint(0xef4444);
      } else {
        this.bossAtmosphereEmitter.setParticleTint(0xf97316);
      }
    }
  }

  spawnGroundDecal(x, y, tint = 0x450a0a) {
    if (!this.decalPool || this.decalPool.length === 0) return;
    const decal = this.decalPool[this.decalPoolIndex];
    this.decalPoolIndex = (this.decalPoolIndex + 1) % this.decalPool.length;

    this.tweens.killTweensOf(decal);
    const radius = 14 + Math.random() * 12;
    decal.setPosition(x, y);
    decal.setSize(radius * 1.4, radius);
    decal.setFillStyle(tint, 0.32);
    decal.setAlpha(0.32);

    this.tweens.add({
      targets: decal,
      alpha: 0,
      duration: 5000 + Math.random() * 1500,
      ease: 'Linear'
    });
  }

  cleanupListeners() {
    if (this.onRestartBound) {
      window.removeEventListener('habey:start-run', this.onRestartBound);
      this.onRestartBound = null;
    }
    if (this.onReturnMenuBound) {
      window.removeEventListener('habey:return-menu', this.onReturnMenuBound);
      this.onReturnMenuBound = null;
    }
    if (this.onWindowPointerMoveBound) {
      window.removeEventListener('pointermove', this.onWindowPointerMoveBound);
      this.onWindowPointerMoveBound = null;
    }
    if (this.onWindowPointerUpBound) {
      window.removeEventListener('pointerup', this.onWindowPointerUpBound);
      window.removeEventListener('pointercancel', this.onWindowPointerUpBound);
      this.onWindowPointerUpBound = null;
    }
  }

  setupInputs() {
    this.cleanupListeners();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
      P: Phaser.Input.Keyboard.KeyCodes.P
    });

    this.keys.P.on('down', () => {
      this.debugPanel.toggle();
    });

    this.keys.SPACE.on('down', () => {
      if (!this.isPausedByDebug && !this.isPausedByLevelUp && !this.isGameOver) {
        this.player.tryDash(performance.now());
      }
    });

    // Mobile / Touch Virtual Joystick & Dash button (with multi-touch pointerId isolation)
    const joyZone = document.getElementById('mobile-joystick-zone');
    const joyKnob = document.getElementById('mobile-joystick-knob');
    const dashBtn = document.getElementById('btn-mobile-dash');

    if (dashBtn) {
      dashBtn.onpointerdown = (e) => {
        e.stopPropagation();
        if (!this.isPausedByDebug && !this.isPausedByLevelUp && !this.isGameOver) {
          this.player.tryDash(performance.now());
        }
      };
      dashBtn.onclick = () => {
        if (!this.isPausedByDebug && !this.isPausedByLevelUp && !this.isGameOver) {
          this.player.tryDash(performance.now());
        }
      };
    }

    if (joyZone && joyKnob) {
      let activePointerId = null;
      let startX = 0;
      let startY = 0;
      const maxRadius = 40;

      const updateStick = (clientX, clientY) => {
        const dx = clientX - startX;
        const dy = clientY - startY;
        const dist = Math.hypot(dx, dy) || 1;
        const clamped = Math.min(dist, maxRadius);
        const nx = dx / dist;
        const ny = dy / dist;
        joyKnob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
        this.joystickVec.x = (nx * clamped) / maxRadius;
        this.joystickVec.y = (ny * clamped) / maxRadius;
      };

      const endStick = () => {
        activePointerId = null;
        joyKnob.style.transform = 'translate(0px, 0px)';
        this.joystickVec.x = 0;
        this.joystickVec.y = 0;
      };

      joyZone.onpointerdown = (e) => {
        activePointerId = e.pointerId ?? 'mouse';
        const rect = joyZone.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
        updateStick(e.clientX, e.clientY);
      };

      this.onWindowPointerMoveBound = (e) => {
        if (activePointerId !== null && (e.pointerId ?? 'mouse') === activePointerId) {
          updateStick(e.clientX, e.clientY);
        }
      };
      this.onWindowPointerUpBound = (e) => {
        if (activePointerId !== null && (e.pointerId ?? 'mouse') === activePointerId) {
          endStick();
        }
      };

      window.addEventListener('pointermove', this.onWindowPointerMoveBound);
      window.addEventListener('pointerup', this.onWindowPointerUpBound);
      window.addEventListener('pointercancel', this.onWindowPointerUpBound);
    }
  }

  getMovementInputVector() {
    let ix = this.joystickVec.x;
    let iy = this.joystickVec.y;

    if (this.cursors.left.isDown || this.keys.A.isDown) ix -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) ix += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) iy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) iy += 1;

    return { x: ix, y: iy };
  }

  setBossAtmosphere(active, isMainBoss = false) {
    this.bossAtmosphereActive = Boolean(active);
    const vignette = document.getElementById('boss-vignette');
    if (vignette) {
      vignette.classList.toggle('hidden', !active);
      vignette.classList.toggle('main-boss-vignette', Boolean(active && isMainBoss));
    }
    if (this.floorTile) {
      this.floorTile.setTint(active ? (isMainBoss ? 0xfda4af : 0xd8b4fe) : 0xffffff);
    }
  }

  queueLevelUp() {
    this.pendingLevelUps += 1;
    if (!this.isPausedByLevelUp && !this.isGameOver) {
      this.openNextLevelUp();
    }
  }

  openNextLevelUp() {
    if (this.pendingLevelUps <= 0 || this.isGameOver) return;
    this.isPausedByLevelUp = true;
    this.physics.pause();
    soundManager.playLevelUp();
    uiManager.openLevelUpModal();
  }

  onLevelUpChoiceCompleted() {
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    if (this.pendingLevelUps > 0 && !this.isGameOver) {
      uiManager.openLevelUpModal();
      return;
    }
    this.isPausedByLevelUp = false;
    if (!this.isPausedByDebug && !this.isGameOver) {
      this.physics.resume();
    }
  }

  handleGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.physics.pause();

    saveManager.recordRunEnd({
      timeSeconds: this.runSeconds,
      level: this.player.level,
      kills: this.player.kills,
      goldEarned: this.player.goldEarned
    });

    uiManager.showGameOverAnalytics();
  }

  update(_time, deltaMs) {
    if (this.isPausedByDebug || this.isPausedByLevelUp || this.isGameOver) return;

    const now = performance.now();
    const clampedDelta = Math.min(deltaMs, 64);

    // Advance main run clock ONLY when not locked by a Main Boss!
    if (!this.isTimerLockedByBoss) {
      this.runSeconds += clampedDelta / 1000;
    }

    // Scroll infinite floor tile with camera
    if (this.floorTile) {
      this.floorTile.tilePositionX = this.cameras.main.scrollX;
      this.floorTile.tilePositionY = this.cameras.main.scrollY;
    }

    const inputVec = this.getMovementInputVector();
    this.player.update(now, clampedDelta, inputVec);
    this.updateGroundPropsAndWeather(clampedDelta);
    this.spawnSystem.update(now, clampedDelta, this.player, this.runSeconds);
    this.combatSystem.update(now, clampedDelta, this.player);
    this.gemManager.update(now, clampedDelta, this.player);

    this.hudTickTimer += clampedDelta;
    if (this.hudTickTimer >= 120) {
      this.hudTickTimer = 0;
      uiManager.updateHud();
    }
  }
}

export default GameScene;
