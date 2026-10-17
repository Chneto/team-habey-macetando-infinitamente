import { CHARACTERS_DATA } from '../config/charactersData.js';
import { ENEMY_TYPES, MINI_BOSS_TEMPLATES, MAIN_BOSS_TEMPLATES, PETS_DATA } from '../config/enemiesData.js';
import { ELEMENTS } from '../config/elementsData.js';

export class AnimationSystem {
  static registerAllAnimations(scene) {
    const keys = new Set([
      ...CHARACTERS_DATA.map((c) => c.spriteKey),
      ...PETS_DATA.map((p) => p.spriteKey),
      ...ENEMY_TYPES.map((e) => e.spriteKey),
      'boss_archon',
      ...MINI_BOSS_TEMPLATES.map((b) => b.spriteKey).filter(Boolean),
      ...MAIN_BOSS_TEMPLATES.map((b) => b.spriteKey).filter(Boolean)
    ]);

    for (const key of keys) {
      if (!scene.textures.exists(key)) continue;

      if (!scene.anims.exists(`${key}_idle`)) {
        scene.anims.create({
          key: `${key}_idle`,
          frames: [{ key, frame: 0 }],
          frameRate: 4,
          repeat: -1
        });
      }

      if (!scene.anims.exists(`${key}_walk`)) {
        scene.anims.create({
          key: `${key}_walk`,
          frames: [
            { key, frame: 1 },
            { key, frame: 2 }
          ],
          frameRate: 8,
          repeat: -1
        });
      }

      if (!scene.anims.exists(`${key}_cast`)) {
        scene.anims.create({
          key: `${key}_cast`,
          frames: [
            { key, frame: 3 },
            { key, frame: 0 }
          ],
          frameRate: 8,
          repeat: 0
        });
      }
    }
  }

  /**
   * Applies sinusoidal Squash & Stretch:
   * scaleX = baseScale * (1 + 0.06 * sin(wt))
   * scaleY = baseScale * (1 - 0.06 * sin(wt))
   * and +-5 deg lean angle in movement direction.
   */
  static updateLocomotion(sprite, vx, vy, timeMs, baseScale = 1.0, phaseOffset = 0) {
    if (!sprite || !sprite.active) return;

    const speedSq = vx * vx + vy * vy;
    const isMoving = speedSq > 4;
    const omega = isMoving ? 0.016 : 0.005;
    const amp = isMoving ? 0.075 : 0.025;
    const wave = Math.sin(timeMs * omega + phaseOffset);

    // Sinusoidal Squash & Stretch
    const sx = baseScale * (1 + amp * wave);
    const sy = baseScale * (1 - amp * wave);
    sprite.setScale(sx, sy);

    if (Math.abs(vx) > 2) {
      sprite.setFlipX(vx < 0);
    }

    if (isMoving) {
      const leanSign = vx >= 0 ? 1 : -1;
      sprite.setAngle(leanSign * 6.5 * Math.sin(timeMs * 0.014 + phaseOffset));

      // Subtle dynamic footstep dust / spark puffs when running
      if (Math.random() < 0.08 && sprite.scene) {
        const puff = sprite.scene.add
          .circle(sprite.x + (Math.random() - 0.5) * 12, sprite.y + 16 * baseScale, 3.5, 0x94a3b8, 0.3)
          .setDepth(5);
        sprite.scene.tweens.add({
          targets: puff,
          scale: 1.8,
          alpha: 0,
          duration: 180,
          onComplete: () => puff.destroy()
        });
      }
    } else {
      sprite.setAngle(0);
    }

    const texKey = sprite.texture?.key;
    if (texKey && sprite.anims) {
      const currentAnim = sprite.anims.currentAnim?.key;
      const castAnim = `${texKey}_cast`;
      if (currentAnim === castAnim && sprite.anims.isPlaying) {
        return;
      }
      const targetAnim = isMoving ? `${texKey}_walk` : `${texKey}_idle`;
      if (currentAnim !== targetAnim && sprite.scene.anims.exists(targetAnim)) {
        sprite.play(targetAnim, true);
      }
    }
  }

  static playCastAnimation(sprite) {
    if (!sprite || !sprite.active || !sprite.anims) return;
    const texKey = sprite.texture?.key;
    const castAnim = `${texKey}_cast`;
    if (sprite.scene.anims.exists(castAnim)) {
      sprite.play(castAnim, true);
    }
  }

  /**
   * Creates Petrus's 4 independent articulated floating stone arms
   */
  static createPetrusFourArms(scene, playerX, playerY) {
    const offsets = [
      { id: 0, ox: -24, oy: -14, baseAngle: -20 },
      { id: 1, ox: 24, oy: -14, baseAngle: 20 },
      { id: 2, ox: -26, oy: 8, baseAngle: -10 },
      { id: 3, ox: 26, oy: 8, baseAngle: 10 }
    ];

    return offsets.map((slot) => {
      const armSprite = scene.add.sprite(playerX + slot.ox, playerY + slot.oy, 'petrus_rock_arm');
      armSprite.setDepth(16);
      return {
        ...slot,
        sprite: armSprite,
        recoilOffsetX: 0,
        recoilOffsetY: 0,
        aimAngle: 0,
        isRecoiling: false
      };
    });
  }

  static updatePetrusFourArms(arms, playerX, playerY, timeMs, aimX = null, aimY = null) {
    if (!arms || arms.length === 0) return;

    for (let i = 0; i < arms.length; i++) {
      const arm = arms[i];
      if (!arm.sprite || !arm.sprite.active) continue;

      const hoverY = Math.sin(timeMs * 0.006 + i * 1.5) * 3.5;
      const hoverX = Math.cos(timeMs * 0.004 + i * 1.2) * 1.5;

      arm.sprite.x = playerX + arm.ox + hoverX + arm.recoilOffsetX;
      arm.sprite.y = playerY + arm.oy + hoverY + arm.recoilOffsetY;

      if (aimX !== null && aimY !== null) {
        const angleRad = Math.atan2(aimY - arm.sprite.y, aimX - arm.sprite.x);
        arm.sprite.setRotation(angleRad);
      } else {
        arm.sprite.setAngle(arm.baseAngle + Math.sin(timeMs * 0.005 + i) * 6);
      }
    }
  }

  static triggerArmRecoil(scene, arm, targetX, targetY) {
    if (!arm || !arm.sprite || !arm.sprite.active) return;

    const angle = Math.atan2(targetY - arm.sprite.y, targetX - arm.sprite.x);
    arm.sprite.setRotation(angle);

    const pullBackX = -Math.cos(angle) * 9;
    const pullBackY = -Math.sin(angle) * 9;
    const thrustX = Math.cos(angle) * 12;
    const thrustY = Math.sin(angle) * 12;

    arm.sprite.setTint(0xfbbf24);

    scene.tweens.add({
      targets: arm,
      recoilOffsetX: pullBackX,
      recoilOffsetY: pullBackY,
      duration: 55,
      yoyo: false,
      onComplete: () => {
        scene.tweens.add({
          targets: arm,
          recoilOffsetX: thrustX,
          recoilOffsetY: thrustY,
          duration: 70,
          onComplete: () => {
            if (arm.sprite && arm.sprite.active) arm.sprite.clearTint();
            scene.tweens.add({
              targets: arm,
              recoilOffsetX: 0,
              recoilOffsetY: 0,
              duration: 110
            });
          }
        });
      }
    });
  }

  /**
   * Creates character-specific procedural visual aura & silhouette attachments
   */
  static createCharacterTraitLayer(scene, charData, x, y) {
    const gfx = scene.add.graphics();
    gfx.setPosition(x, y);
    gfx.setDepth(14);
    return {
      gfx,
      charId: charData.id,
      primaryColor: charData.primaryColor || 0x8b5cf6,
      accentColor: charData.accentColor || 0xfbbf24
    };
  }

  static updateCharacterTraitLayer(layer, x, y, vx, vy, timeMs, player = null) {
    if (!layer || !layer.gfx || !layer.gfx.active) return;
    const g = layer.gfx;
    g.setPosition(x, y);
    g.clear();

    const t = timeMs * 0.001;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.5);

    // Subtle ground shadow + arcane class ring under feet
    g.fillStyle(0x05050a, 0.45);
    g.fillEllipse(0, 22, 34, 12);
    g.lineStyle(1.6, layer.accentColor, 0.32 + pulse * 0.18);
    g.strokeEllipse(0, 22, 36 + pulse * 3, 13 + pulse * 1.5);

    // Temporary Chest / Pet Buff Rings (Fury Chalice / Rock Golem Seismic)
    if (player && timeMs < player.furyBuffUntil) {
      g.lineStyle(2.2, 0xef4444, 0.75 + pulse * 0.2);
      g.strokeEllipse(0, 22, 44 + pulse * 4, 16 + pulse * 2);
    }
    if (player && timeMs < player.seismicBuffUntil) {
      g.lineStyle(2.0, 0xf59e0b, 0.75);
      g.strokeEllipse(0, 22, 48, 18);
    }

    switch (layer.charId) {
      case 'petrus': {
        // Orbiting seismic shards around waist
        for (let i = 0; i < 3; i++) {
          const a = t * 1.8 + (i * Math.PI * 2) / 3;
          const sx = Math.cos(a) * 28;
          const sy = 6 + Math.sin(a) * 10;
          g.fillStyle(0xd97706, 0.8);
          g.fillRect(sx - 2.5, sy - 2.5, 5, 5);
        }
        // Innate Passive: Quatro Punhos da Montanha (4-hit cycle indicator pips above crown)
        const charge = player ? (player.attackCounter || 0) % 4 : 0;
        for (let p = 0; p < 4; p++) {
          const px = -12 + p * 8;
          const py = -34;
          const active = p <= charge;
          g.fillStyle(active ? (charge === 3 ? 0xfef08a : 0xf59e0b) : 0x44403c, active ? 0.92 : 0.45);
          g.fillCircle(px, py, active && charge === 3 ? 3.2 : 2.3);
        }
        break;
      }
      case 'ignis': {
        // Rising solar-flame embers + volcanic heat shimmer ring
        g.lineStyle(1.4, 0xf97316, 0.35 + pulse * 0.25);
        g.strokeCircle(0, -2, 24 + pulse * 3);
        for (let i = 0; i < 5; i++) {
          const phase = (t * 2.4 + i * 1.25) % (Math.PI * 2);
          const ex = Math.cos(phase * 1.5 + i) * 21;
          const ey = -6 - ((phase / (Math.PI * 2)) * 24);
          g.fillStyle(i % 2 === 0 ? 0xfbbf24 : 0xf97316, 0.85);
          g.fillCircle(ex, ey, 2.8);
        }
        break;
      }
      case 'crya': {
        // 4 orbiting crystalline frost diamonds + Zero Absoluto frost mist ring
        g.lineStyle(1.3, 0x38bdf8, 0.38);
        g.strokeEllipse(0, 4, 48, 22);
        for (let i = 0; i < 4; i++) {
          const a = -t * 1.6 + (i * Math.PI) / 2;
          const fx = Math.cos(a) * 26;
          const fy = Math.sin(a) * 12;
          g.fillStyle(0x7dd3fc, 0.86);
          g.fillTriangle(fx, fy - 4.5, fx + 3.2, fy, fx, fy + 4.5);
          g.fillTriangle(fx, fy - 4.5, fx - 3.2, fy, fx, fy + 4.5);
        }
        break;
      }
      case 'volt': {
        // Crackling high-voltage zigzag arcs scaled by Passo Relâmpago walk charge
        const chargeRatio = player ? Math.min(1, (player.voltWalkCharge || 0) / 100) : 0.5;
        const arcCount = 2 + Math.floor(chargeRatio * 2);
        g.lineStyle(1.8 + chargeRatio * 0.8, chargeRatio > 0.75 ? 0x38bdf8 : 0xfef08a, 0.88);
        for (let i = 0; i < arcCount; i++) {
          const baseA = t * 5.5 + (i * Math.PI * 2) / arcCount;
          const x1 = Math.cos(baseA) * 22;
          const y1 = Math.sin(baseA) * 16;
          const x2 = Math.cos(baseA + 0.9) * 24;
          const y2 = Math.sin(baseA + 0.9) * 16;
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo((x1 + x2) * 0.5 + Math.sin(t * 25 + i) * 5, (y1 + y2) * 0.5 - 4);
          g.lineTo(x2, y2);
          g.strokePath();
        }
        if (chargeRatio > 0.2) {
          g.lineStyle(1.6, 0xfacc15, 0.4 + chargeRatio * 0.45);
          g.strokeCircle(0, 0, 26 * chargeRatio + 6);
        }
        break;
      }
      case 'sylas': {
        // Drifting emerald leaf motes + Pack Lord nature bond ring
        for (let i = 0; i < 4; i++) {
          const a = t * 1.5 + (i * Math.PI) / 2;
          const lx = Math.cos(a) * 25;
          const ly = Math.sin(a * 2) * 10;
          g.fillStyle(i % 2 === 0 ? 0x4ade80 : 0xa3e635, 0.82);
          g.fillEllipse(lx, ly, 6.5, 3.2);
        }
        break;
      }
      case 'zephyr': {
        // Twin trailing wind ribbons streaming opposite to movement
        const dirX = Math.abs(vx) + Math.abs(vy) > 5 ? -vx / 220 : -1;
        const dirY = Math.abs(vx) + Math.abs(vy) > 5 ? -vy / 220 : 0;
        g.lineStyle(2.1, 0x99f6e4, 0.72);
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(side * 10, -6);
          const wave = Math.sin(t * 8 + side) * 6;
          g.lineTo(side * 14 + dirX * 18, -2 + dirY * 14 + wave);
          g.lineTo(side * 16 + dirX * 30, 4 + dirY * 24 - wave * 0.6);
          g.strokePath();
        }
        break;
      }
      case 'nyx': {
        // Dual counter-rotating void singularity rings + Horizon Hunger barrier satellites
        g.lineStyle(1.6, 0xc084fc, 0.6);
        g.strokeEllipse(0, 0, 46, 20);
        const barriers = player ? player.barrierCharges || 0 : 0;
        const satelliteCount = Math.max(2, barriers + 1);
        for (let i = 0; i < satelliteCount; i++) {
          const a = t * 2.4 + (i * Math.PI * 2) / satelliteCount;
          g.fillStyle(barriers > 0 ? 0xf0abfc : 0xe879f9, 0.92);
          g.fillCircle(Math.cos(a) * 23, Math.sin(a) * 10, barriers > 0 ? 3.8 : 3.0);
        }
        break;
      }
      case 'solarius': {
        // Rotating golden solar halo behind head + Égide Radiante charge glow
        const aegisRatio =
          player && player.maxHp > 0
            ? Math.min(1, (player.cumulativeHpLost || 0) / (player.maxHp * 0.2))
            : 0;
        g.lineStyle(2 + aegisRatio * 1.2, 0xfde047, 0.78 + aegisRatio * 0.2);
        g.strokeCircle(0, -14, 15 + pulse * 1.5 + aegisRatio * 3);
        for (let i = 0; i < 8; i++) {
          const a = t * 1.2 + (i * Math.PI) / 4;
          g.beginPath();
          g.moveTo(Math.cos(a) * 15, -14 + Math.sin(a) * 15);
          g.lineTo(Math.cos(a) * (20 + aegisRatio * 4), -14 + Math.sin(a) * (20 + aegisRatio * 4));
          g.strokePath();
        }
        break;
      }
      case 'alchemius': {
        // 3 orbiting tri-elemental alchemical flasks (ruby, emerald, sapphire)
        const colors = [0xef4444, 0x22c55e, 0x38bdf8];
        for (let i = 0; i < 3; i++) {
          const a = t * 2.1 + (i * Math.PI * 2) / 3;
          const fx = Math.cos(a) * 26;
          const fy = Math.sin(a) * 13;
          g.fillStyle(colors[i], 0.9);
          g.fillCircle(fx, fy, 4);
          g.lineStyle(1, 0xffffff, 0.85);
          g.strokeCircle(fx, fy, 4);
        }
        break;
      }
      case 'chronos': {
        // Counter-rotating golden clockwork gears behind shoulders
        g.lineStyle(1.8, 0xfde047, 0.75);
        g.strokeCircle(0, -4, 22);
        for (let i = 0; i < 6; i++) {
          const a = t * 1.5 + (i * Math.PI) / 3;
          const gx = Math.cos(a) * 22;
          const gy = -4 + Math.sin(a) * 22;
          g.fillStyle(0xfbbf24, 0.88);
          g.fillRect(gx - 2, gy - 2, 4, 4);
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * 60ms Hit Flash (setTintFill(0xffffff)) followed by status elemental tint restoration
   */
  static triggerHitFlash(scene, entity) {
    const sprite = entity?.sprite || entity;
    if (!sprite || !sprite.active) return;

    sprite.setTintFill(0xffffff);
    if (entity.hitFlashTimer) {
      entity.hitFlashTimer.remove(false);
    }

    entity.hitFlashTimer = scene.time.delayedCall(60, () => {
      if (!sprite || !sprite.active) return;
      sprite.clearTint();
      this.applyElementalTint(entity);
    });
  }

  static applyElementalTint(entity) {
    const sprite = entity?.sprite;
    if (!sprite || !sprite.active) return;

    if (entity.activeElement && ELEMENTS[entity.activeElement]) {
      sprite.setTint(ELEMENTS[entity.activeElement].color);
    } else if (entity.preserveBasePalette) {
      sprite.clearTint();
    } else if (entity.baseTint) {
      sprite.setTint(entity.baseTint);
    } else {
      sprite.clearTint();
    }
  }
}

export default AnimationSystem;
