import { ELEMENTS } from '../config/elementsData.js';
import { getScaledEnemyHp, getScaledXpDrop } from '../config/enemiesData.js';
import AnimationSystem from '../systems/AnimationSystem.js';

export class Enemy {
  constructor(scene, x, y, typeData, minuteT = 0, killsK = 0, extraConfig = {}) {
    this.scene = scene;
    this.typeData = typeData;
    this.isBoss = false;
    this.isMiniBoss = false;
    this.isDead = false;

    this.maxHp = getScaledEnemyHp(typeData.hp, minuteT, killsK) * (extraConfig.hpMult || 1.0);
    this.hp = this.maxHp;
    this.baseSpeed = typeData.speed * (extraConfig.speedMult || 1.0);
    this.damage = Math.round(typeData.damage * (1 + minuteT * 0.14));
    this.weight = typeData.weight || 1.0;
    this.xpValue = getScaledXpDrop(typeData.xp, minuteT, killsK);
    this.baseScale = typeData.scale || 1.0;
    this.baseTint = extraConfig.imbuedColor || null;

    this.sprite = scene.physics.add.sprite(x, y, typeData.spriteKey, 0);
    this.sprite.setDepth(10);
    this.sprite.setScale(this.baseScale);
    this.sprite.body.setSize(28, 32);
    this.sprite.body.setOffset(18, 18);
    this.sprite.enemyRef = this;

    if (this.baseTint) {
      this.sprite.setTint(this.baseTint);
    }

    // Status effects
    this.activeElement = extraConfig.imbuedElement || null;
    this.elementExpiresAt = this.activeElement ? performance.now() + 999999 : 0;
    this.dotTickTimer = 0;
    this.stunnedUntil = 0;
    this.slowPct = 0;
    this.slowUntil = 0;
    this.armorReduction = 0;
    this.vulnerabilityBonus = 0;

    // Knockback velocity
    this.kbVx = 0;
    this.kbVy = 0;

    // Ranged firing
    this.fireTimer = typeData.ranged ? (typeData.fireInterval || 2500) * (0.5 + Math.random() * 0.5) : 0;

    // Special horde behavior (e.g. Stampede fixed velocity or Iron Ring slow contraction)
    this.stampedeVelocity = extraConfig.stampedeVelocity || null;
    this.phaseOffset = Math.random() * Math.PI * 2;
    this.abilityTimer = 1800 + Math.random() * 1400;
    this.pounceUntil = 0;
    this.boneShieldActive = false;
    this.shadowCloaked = false;

    this.decorGfx = scene.add.graphics();
    this.decorGfx.setDepth(9);
  }

  applyElementStatus(elementId, timeMs) {
    if (!elementId || !ELEMENTS[elementId]) return;
    this.activeElement = elementId;
    this.elementExpiresAt = timeMs + ELEMENTS[elementId].duration * (this.scene.player?.durationMult || 1.0);

    if (elementId === 'ice') {
      let chill = 0.30;
      if (this.scene.player?.characterData.id === 'crya') chill += 0.15;
      this.slowPct = Math.max(this.slowPct, chill);
      this.slowUntil = Math.max(this.slowUntil, this.elementExpiresAt);
    } else if (elementId === 'poison') {
      this.armorReduction = Math.max(this.armorReduction, 0.20);
    } else if (elementId === 'earth') {
      this.slowPct = Math.max(this.slowPct, 0.15);
      this.slowUntil = Math.max(this.slowUntil, timeMs + 1500);
    }

    AnimationSystem.applyElementalTint(this);
  }

  applyKnockback(fromX, fromY, force) {
    if (this.isDead || !this.sprite?.active || force === 0) return;
    const dx = this.sprite.x - fromX;
    const dy = this.sprite.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const effForce = force / Math.max(0.4, this.weight);
    this.kbVx = (dx / len) * effForce;
    this.kbVy = (dy / len) * effForce;
  }

  applyStun(durationMs, timeMs = performance.now()) {
    this.stunnedUntil = Math.max(this.stunnedUntil, timeMs + durationMs);
  }

  getElementMultiplier(attackElement) {
    if (!attackElement) return 1.0;
    let mult = 1.0;
    if (this.typeData.resistances && this.typeData.resistances[attackElement]) {
      mult -= this.typeData.resistances[attackElement];
    }
    if (this.typeData.vulnerabilities && this.typeData.vulnerabilities[attackElement]) {
      mult += this.typeData.vulnerabilities[attackElement];
    }
    return Math.max(0.25, mult);
  }

  update(timeMs, deltaMs, player) {
    if (this.isDead || !this.sprite || !this.sprite.active) return;

    // Frozen by Chronos Hourglass chest item
    if (timeMs < (this.scene.enemiesFrozenUntil || 0)) {
      this.sprite.body.setVelocity(0, 0);
      this.updateDecor(timeMs);
      return;
    }

    // Expire elemental status or restore base palette when status was consumed/cleared
    if (this.activeElement) {
      if (timeMs >= this.elementExpiresAt) {
        this.activeElement = null;
        this.armorReduction = 0;
        this.vulnerabilityBonus = 0;
        AnimationSystem.applyElementalTint(this);
      }
    } else if (this.preserveBasePalette && this.sprite.isTinted) {
      AnimationSystem.applyElementalTint(this);
    }

    // Periodic DoT ticks (Fire / Poison)
    if (this.activeElement === 'fire' || this.activeElement === 'poison') {
      this.dotTickTimer += deltaMs;
      if (this.dotTickTimer >= 500) {
        this.dotTickTimer -= 500;
        let dotDmg = Math.max(2, Math.round(8 * (player?.damageMult || 1)));
        if (this.activeElement === 'fire' && player?.characterData.id === 'ignis') {
          dotDmg = Math.round(dotDmg * 1.35);
        }
        this.scene.combatSystem?.dealDamageToEnemy(this, dotDmg, {
          element: null,
          sourceId: 'dot_status',
          isDot: true
        });
        if (this.isDead) return;
      }
    }

    if (timeMs >= this.slowUntil) {
      this.slowPct = 0;
    }

    // Decay knockback
    this.kbVx *= 0.84;
    this.kbVy *= 0.84;
    if (Math.abs(this.kbVx) < 2) this.kbVx = 0;
    if (Math.abs(this.kbVy) < 2) this.kbVy = 0;

    if (timeMs < this.stunnedUntil) {
      this.sprite.body.setVelocity(this.kbVx, this.kbVy);
      this.updateDecor(timeMs);
      return;
    }

    const px = player.sprite.x;
    const py = player.sprite.y;
    const dx = px - this.sprite.x;
    const dy = py - this.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const perpX = -ny;
    const perpY = nx;

    // Release stampede velocity once the enemy has crossed past the screen
    if (this.stampedeVelocity && dist > 1100) {
      this.stampedeVelocity = null;
    }

    // Dynamic Repositioning if far behind camera (> 1150px)
    if (!this.isBoss && !this.isMiniBoss && dist > 1150 && !this.stampedeVelocity) {
      const moveDir = player.lastMoveDir || { x: 1, y: 0 };
      const angleSpread = (Math.random() - 0.5) * 1.4;
      const baseAngle = Math.atan2(moveDir.y, moveDir.x) + angleSpread;
      const spawnDist = 640 + Math.random() * 140;
      this.sprite.setPosition(
        px + Math.cos(baseAngle) * spawnDist,
        py + Math.sin(baseAngle) * spawnDist
      );
      this.updateDecor(timeMs);
      return;
    }

    const speedMult = Math.max(0.2, 1 - this.slowPct);
    let effSpeed = this.baseSpeed * speedMult;

    let vx = 0;
    let vy = 0;

    if (this.stampedeVelocity) {
      vx = this.stampedeVelocity.vx * speedMult;
      vy = this.stampedeVelocity.vy * speedMult;
    } else if (!this.isBoss && !this.isMiniBoss) {
      // Archetype-specific AI movement & combat traits for all 6 regular enemies
      const typeId = this.typeData.id;
      this.abilityTimer -= deltaMs;

      if (typeId === 'goblin_runner') {
        // Serpentine weave + close-range frenzy sprint
        const sprint = dist < 175 ? 1.26 : 1.0;
        const weave = Math.sin(timeMs * 0.007 + this.phaseOffset) * 0.42;
        vx = (nx + perpX * weave) * effSpeed * sprint;
        vy = (ny + perpY * weave) * effSpeed * sprint;
      } else if (typeId === 'skeleton_warrior') {
        // Periodic Bone Phalanx Shield stance (reduces incoming direct damage by 25%)
        this.boneShieldActive = Math.sin(timeMs * 0.0022 + this.phaseOffset) > 0.3;
        const shieldPace = this.boneShieldActive ? 0.88 : 1.06;
        vx = nx * effSpeed * shieldPace;
        vy = ny * effSpeed * shieldPace;
      } else if (typeId === 'stone_golem') {
        // Unstoppable tectonic march
        vx = nx * effSpeed;
        vy = ny * effSpeed;
      } else if (typeId === 'arcane_cultist') {
        // Ranged kiting & lateral circle-strafing at 220-340px
        const strafeDir = this.phaseOffset > Math.PI ? 1 : -1;
        if (dist < 190) {
          vx = (-nx * 0.55 + perpX * strafeDir * 0.75) * effSpeed;
          vy = (-ny * 0.55 + perpY * strafeDir * 0.75) * effSpeed;
        } else if (dist < 320) {
          vx = (nx * 0.25 + perpX * strafeDir * 0.9) * effSpeed;
          vy = (ny * 0.25 + perpY * strafeDir * 0.9) * effSpeed;
        } else {
          vx = nx * effSpeed;
          vy = ny * effSpeed;
        }
      } else if (typeId === 'lightning_stalker') {
        // Periodic high-voltage pounce dash toward player
        if (this.abilityTimer <= 0 && dist < 360) {
          this.abilityTimer = 3100 + Math.random() * 700;
          this.pounceUntil = timeMs + 340;
          AnimationSystem.playCastAnimation(this.sprite);
        }
        const pounceMult = timeMs < this.pounceUntil ? 1.78 : 1.0;
        vx = nx * effSpeed * pounceMult;
        vy = ny * effSpeed * pounceMult;
      } else if (typeId === 'shadow_assassin') {
        // Shadow Cloak stealth approach (translucent at mid-range) + twin kunai fan throw
        const cloaked = dist > 145 && dist < 380;
        if (cloaked !== this.shadowCloaked) {
          this.shadowCloaked = cloaked;
          this.sprite.setAlpha(cloaked ? 0.55 : 1.0);
        }
        const stalkMult = cloaked ? 1.24 : 1.05;
        const flank = Math.cos(timeMs * 0.005 + this.phaseOffset) * 0.35;
        vx = (nx + perpX * flank) * effSpeed * stalkMult;
        vy = (ny + perpY * flank) * effSpeed * stalkMult;

        if (this.abilityTimer <= 0 && dist < 260) {
          this.abilityTimer = 3400 + Math.random() * 800;
          AnimationSystem.playCastAnimation(this.sprite);
          const baseAng = Math.atan2(dy, dx);
          for (const spread of [-0.16, 0.16]) {
            const ang = baseAng + spread;
            this.scene.combatSystem?.spawnEnemyProjectile(
              this.sprite.x,
              this.sprite.y,
              this.sprite.x + Math.cos(ang) * 200,
              this.sprite.y + Math.sin(ang) * 200,
              275,
              Math.max(4, Math.round(this.damage * 0.75)),
              0xc084fc
            );
          }
        }
      } else {
        vx = nx * effSpeed;
        vy = ny * effSpeed;
      }
    } else {
      vx = nx * effSpeed;
      vy = ny * effSpeed;
    }

    this.sprite.body.setVelocity(vx + this.kbVx, vy + this.kbVy);
    AnimationSystem.updateLocomotion(this.sprite, vx, vy, timeMs, this.baseScale, this.phaseOffset);

    // Ranged enemy / Mini-Boss / Boss projectile attacks
    if (this.typeData.ranged && dist < (this.isBoss || this.isMiniBoss ? 620 : 520)) {
      this.fireTimer -= deltaMs;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.typeData.fireInterval || 2500;
        AnimationSystem.playCastAnimation(this.sprite);
        const baseAng = Math.atan2(dy, dx);
        const pSpeed = this.typeData.projectileSpeed || 230;
        const pColor = this.typeData.color || 0xa855f7;
        const spreads = this.isBoss
          ? [-0.34, -0.17, 0, 0.17, 0.34]
          : this.isMiniBoss
            ? [-0.22, 0, 0.22]
            : [0];

        for (const offset of spreads) {
          const ang = baseAng + offset;
          this.scene.combatSystem?.spawnEnemyProjectile(
            this.sprite.x,
            this.sprite.y,
            this.sprite.x + Math.cos(ang) * 240,
            this.sprite.y + Math.sin(ang) * 240,
            pSpeed,
            this.damage,
            pColor
          );
        }
      }
    }

    this.updateDecor(timeMs);
  }

  updateDecor(timeMs) {
    if (!this.decorGfx || !this.decorGfx.active || !this.sprite || !this.sprite.active) return;
    const g = this.decorGfx;
    g.setPosition(this.sprite.x, this.sprite.y);
    g.clear();

    // Cull per-frame Graphics drawing when enemy is off-screen
    const cam = this.scene.cameras?.main?.worldView;
    if (
      cam &&
      cam.width > 0 &&
      !this.isBoss &&
      !this.isMiniBoss &&
      (this.sprite.x < cam.x - 80 ||
        this.sprite.x > cam.right + 80 ||
        this.sprite.y < cam.y - 80 ||
        this.sprite.y > cam.bottom + 80)
    ) {
      return;
    }

    const sc = this.baseScale || 1.0;
    const footY = (this.isBoss || this.isMiniBoss ? 30 : 20) * sc;
    const shadowW = (this.isBoss ? 58 : this.isMiniBoss ? 46 : 28) * sc;
    const shadowH = (this.isBoss ? 20 : this.isMiniBoss ? 16 : 10) * sc;

    // Ground shadow
    g.fillStyle(0x05050a, 0.46);
    g.fillEllipse(0, footY, shadowW, shadowH);

    // Boss / Mini-Boss ominous ground aura
    if (this.isBoss || this.isMiniBoss) {
      const pulse = 0.5 + 0.5 * Math.sin(timeMs * 0.004 + this.phaseOffset);
      const auraColor = this.baseTint || 0xf97316;
      g.lineStyle(2.2, auraColor, 0.5 + pulse * 0.25);
      g.strokeEllipse(0, footY, shadowW + 10 + pulse * 4, shadowH + 4 + pulse * 2);

      if (timeMs < (this.reflectShieldUntil || 0)) {
        g.lineStyle(2.5, 0xfbbf24, 0.9);
        g.fillStyle(0xfde047, 0.16);
        g.fillCircle(0, 0, 42 * sc);
        g.strokeCircle(0, 0, 42 * sc);
      }
    } else {
      // Archetype-specific visual signature traits for regular enemies
      const typeId = this.typeData.id;
      const t = timeMs * 0.004 + this.phaseOffset;
      if (typeId === 'skeleton_warrior' && this.boneShieldActive) {
        g.lineStyle(2.2, 0x38bdf8, 0.85);
        g.strokeCircle(0, 0, 20 * sc);
      } else if (typeId === 'stone_golem') {
        g.lineStyle(1.6, 0xf97316, 0.55 + 0.25 * Math.sin(t));
        g.strokeEllipse(0, footY, shadowW + 6, shadowH + 3);
      } else if (typeId === 'lightning_stalker') {
        if (timeMs < this.pounceUntil) {
          g.lineStyle(2.0, 0xfef08a, 0.9);
          g.strokeCircle(0, 0, 22 * sc);
        } else {
          g.fillStyle(0xfacc15, 0.85);
          g.fillCircle(Math.cos(t * 2.5) * 14, Math.sin(t * 2.5) * 10, 2);
        }
      } else if (typeId === 'shadow_assassin' && this.shadowCloaked) {
        g.lineStyle(1.4, 0xa855f7, 0.5);
        g.strokeEllipse(0, footY, shadowW + 4, shadowH + 2);
      }
    }

    // Active elemental status ring & orbiting motes
    if (this.activeElement && ELEMENTS[this.activeElement]) {
      const elColor = ELEMENTS[this.activeElement].color;
      g.lineStyle(1.6, elColor, 0.78);
      g.strokeEllipse(0, footY, shadowW + 4, shadowH + 2);
      const a = timeMs * 0.005 + this.phaseOffset;
      g.fillStyle(elColor, 0.9);
      g.fillCircle(Math.cos(a) * (16 * sc), Math.sin(a) * (10 * sc), 2.6);
      g.fillCircle(Math.cos(a + Math.PI) * (16 * sc), Math.sin(a + Math.PI) * (10 * sc), 2.6);
    }

    // Ranged pre-cast occult hexagram telegraph glow when about to fire
    if (this.typeData.ranged && !this.isBoss && this.fireTimer > 0 && this.fireTimer < 550) {
      const chargePct = 1 - this.fireTimer / 550;
      const r = 18 * (1 - chargePct * 0.35);
      g.lineStyle(1.8, this.typeData.color || 0xa855f7, 0.4 + chargePct * 0.55);
      g.strokeCircle(0, -4, r);
      g.strokeEllipse(0, footY, shadowW + 6 * chargePct, shadowH + 3 * chargePct);
    }

    // World-space HP bar for damaged regular mobs and Mini-Bosses
    if (!this.isBoss && (this.isMiniBoss || this.hp < this.maxHp) && this.hp > 0) {
      const barW = this.isMiniBoss ? 54 : 30;
      const barH = this.isMiniBoss ? 5.5 : 4;
      const barY = -(this.isMiniBoss ? 45 : 27) * sc;
      const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));
      g.fillStyle(0x06070b, 0.92);
      g.fillRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);
      g.fillStyle(0x3f1d24, 0.85);
      g.fillRect(-barW / 2, barY, barW, barH);
      g.fillStyle(this.isMiniBoss ? 0xf59e0b : 0xef4444, 0.98);
      g.fillRect(-barW / 2, barY, barW * pct, barH);
      if (this.isMiniBoss) {
        g.lineStyle(1, 0xfbbf24, 0.8);
        g.strokeRect(-barW / 2 - 1, barY - 1, barW + 2, barH + 2);
      }
    }
  }

  destroy() {
    this.isDead = true;
    if (this.hitFlashTimer) {
      this.hitFlashTimer.remove(false);
    }
    if (this.decorGfx) {
      this.decorGfx.destroy();
      this.decorGfx = null;
    }
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}

export default Enemy;
