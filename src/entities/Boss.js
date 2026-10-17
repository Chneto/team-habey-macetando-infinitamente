import Enemy from './Enemy.js';
import { BOSS_AFFIXES, ENEMY_TYPES } from '../config/enemiesData.js';
import saveManager from '../systems/SaveManager.js';

export class Boss extends Enemy {
  constructor(scene, x, y, template, minuteT = 0, killsK = 0, isMainBoss = true, extraConfig = {}) {
    const resistances = {};
    const vulnerabilities = {};
    if (template.resistElement) {
      resistances[template.resistElement] = 0.50;
    }
    if (Array.isArray(template.vulnerableElements)) {
      for (const el of template.vulnerableElements) {
        vulnerabilities[el] = 0.50;
      }
    }

    super(
      scene,
      x,
      y,
      {
        ...template,
        ranged: true,
        fireInterval: extraConfig.isMilestoneBoss ? 1500 : isMainBoss ? 1900 : 2400,
        projectileSpeed: extraConfig.isMilestoneBoss ? 320 : isMainBoss ? 290 : 250,
        color: template.tint || 0xf97316,
        resistances,
        vulnerabilities
      },
      minuteT,
      killsK,
      extraConfig
    );

    this.template = template;
    this.isBoss = Boolean(isMainBoss);
    this.isMiniBoss = !isMainBoss;
    this.isMilestoneBoss = Boolean(extraConfig.isMilestoneBoss);
    this.milestoneLevel = extraConfig.milestoneLevel || 10;
    this.baseTint = template.tint || template.color || 0xf97316;
    this.preserveBasePalette = true;
    this.sprite.clearTint();
    this.sprite.setDepth(18);
    this.sprite.body.setSize(48, 52);
    this.sprite.body.setOffset(24, 22);

    // Pick 3 random affixes for Milestone Apex Boss, 2 for Main Boss, 1 for Mini-Boss
    const affixCount = this.isMilestoneBoss ? 3 : isMainBoss ? 2 : 1;
    const shuffled = [...BOSS_AFFIXES].sort(() => Math.random() - 0.5);
    this.affixes = shuffled.slice(0, affixCount);
    this.affixIds = new Set(this.affixes.map((a) => a.id));

    // Sudden Death 3-Minute Timer (180s) for Main Bosses
    this.suddenDeathRemainingSec = 180;
    this.overtimeSeconds = 0;
    this.bloodCurseTickAccum = 0;

    // Affix & Telegraph Timers
    this.initialDamage = this.damage;
    this.initialFireInterval = this.typeData.fireInterval;
    this.telegraphTimer = this.isMilestoneBoss ? 2600 : isMainBoss ? 3600 : 4200;
    this.affixTimer = this.isMilestoneBoss ? 4200 : 5000;
    this.reflectShieldUntil = 0;
  }

  hasAffix(affixId) {
    return this.affixIds.has(affixId);
  }

  getAffixLabel() {
    return this.affixes.map((a) => a.name).join(' • ');
  }

  update(timeMs, deltaMs, player) {
    if (this.isDead || !this.sprite || !this.sprite.active) return;

    const dtSec = deltaMs / 1000;

    // Berserker affix: +40% speed & attack below 50% HP
    if (this.hasAffix('berserker') && this.hp < this.maxHp * 0.5) {
      this.baseSpeed = (this.template.speed || 80) * 1.4;
      this.damage = Math.round(this.initialDamage * 1.4);
      this.typeData.fireInterval = Math.round(this.initialFireInterval * 0.72);
    }

    // Vampiric affix: regenerate 0.6% maxHP/s
    if (this.hasAffix('vampiric') && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.006 * dtSec);
    }

    // Main Boss 03:00 Sudden Death & Blood Curse
    if (this.isBoss) {
      if (this.suddenDeathRemainingSec > 0) {
        this.suddenDeathRemainingSec = Math.max(0, this.suddenDeathRemainingSec - dtSec);
      } else {
        this.overtimeSeconds += dtSec;
        this.bloodCurseTickAccum += deltaMs;
        if (this.bloodCurseTickAccum >= 1000) {
          this.bloodCurseTickAccum -= 1000;
          const extraSteps = Math.floor(this.overtimeSeconds / 10);
          const drainPct = 0.05 + extraSteps * 0.02;
          const curseDmg = Math.max(1, Math.round(player.maxHp * drainPct));
          if (!player.isGodMode && !player.isDead) {
            player.hp = Math.max(0, player.hp - curseDmg);
            this.scene.combatSystem?.spawnFloatingText(
              player.sprite.x,
              player.sprite.y - 30,
              `MALDIÇÃO -${curseDmg}`,
              '#ef4444'
            );
            if (player.hp <= 0) {
              player.isDead = true;
              this.scene.handleGameOver();
            }
          }
        }
      }
    }

    // Affix periodic behaviors (Teleporter, Reflector Shield, Summoner)
    this.affixTimer -= deltaMs;
    if (this.affixTimer <= 0) {
      this.affixTimer = 5800;

      if (this.hasAffix('teleporter')) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 210 + Math.random() * 80;
        this.sprite.setPosition(
          player.sprite.x + Math.cos(angle) * dist,
          player.sprite.y + Math.sin(angle) * dist
        );
        this.scene.combatSystem?.spawnFloatingText(this.sprite.x, this.sprite.y - 40, 'TELEPORTE!', '#38bdf8');
      }

      if (this.hasAffix('reflector_shield')) {
        this.reflectShieldUntil = timeMs + 2200;
        this.scene.combatSystem?.spawnFloatingText(this.sprite.x, this.sprite.y - 40, 'ESCUDO REFLETOR!', '#fbbf24');
        // Fire 8-way radial prismatic bolts as documented in BOSS_AFFIXES
        if (this.scene.combatSystem) {
          for (let i = 0; i < 8; i++) {
            const ang = (Math.PI * 2 * i) / 8;
            this.scene.combatSystem.spawnEnemyProjectile(
              this.sprite.x,
              this.sprite.y,
              this.sprite.x + Math.cos(ang) * 260,
              this.sprite.y + Math.sin(ang) * 260,
              250,
              Math.max(6, Math.round(this.damage * 0.85)),
              0xfbbf24
            );
          }
        }
      }

      if (this.hasAffix('summoner') && this.scene.spawnSystem) {
        for (let i = 0; i < 3; i++) {
          const ang = (Math.PI * 2 * i) / 3;
          this.scene.spawnSystem.spawnEnemyAt(
            this.sprite.x + Math.cos(ang) * 75,
            this.sprite.y + Math.sin(ang) * 75,
            ENEMY_TYPES[1]
          );
        }
      }
    }

    // Ground Telegraph AoE Strike
    this.telegraphTimer -= deltaMs;
    if (this.telegraphTimer <= 0) {
      this.telegraphTimer = this.isMilestoneBoss ? 2600 : this.isBoss ? 3600 : 4800;
      this.castGroundTelegraph(player);
    }

    super.update(timeMs, deltaMs, player);
  }

  castGroundTelegraph(player) {
    if (!player || player.isDead || !this.scene) return;
    const tx = player.sprite.x + (Math.random() - 0.5) * 90;
    const ty = player.sprite.y + (Math.random() - 0.5) * 90;
    const radius = (this.isMilestoneBoss ? 140 : this.isBoss ? 115 : 85);

    const circle = this.scene.add.circle(tx, ty, radius, this.isMilestoneBoss ? 0xf59e0b : 0xef4444, 0.22);
    circle.setStrokeStyle(3.5, 0xfef08a, 0.92);
    circle.setDepth(4);

    const innerRing = this.scene.add.circle(tx, ty, 12, 0xf87171, 0.42);
    innerRing.setStrokeStyle(2, 0xffffff, 0.8);
    innerRing.setDepth(4);

    this.scene.tweens.add({
      targets: innerRing,
      radius,
      duration: this.isMilestoneBoss ? 950 : 1150,
      onComplete: () => {
        circle.destroy();
        innerRing.destroy();
        if (this.isDead || !this.scene || this.scene.isGameOver) return;

        // Visual detonation ring
        const blast = this.scene.add.circle(tx, ty, radius, this.isMilestoneBoss ? 0xf59e0b : 0xf97316, 0.55 * saveManager.getVfxOpacity());
        blast.setStrokeStyle(3, 0xfef08a, 0.9);
        blast.setDepth(12);
        this.scene.tweens.add({
          targets: blast,
          alpha: 0,
          scale: 1.25,
          duration: 240,
          onComplete: () => blast.destroy()
        });

        // Milestone Boss fires radial shockwave pulse from detonation point
        if (this.isMilestoneBoss && this.scene.combatSystem) {
          for (let s = 0; s < 8; s++) {
            const sang = (Math.PI * 2 * s) / 8;
            this.scene.combatSystem.spawnEnemyProjectile(
              tx,
              ty,
              tx + Math.cos(sang) * 260,
              ty + Math.sin(sang) * 260,
              270,
              Math.max(8, Math.round(this.damage * 0.7)),
              0xf59e0b
            );
          }
        }

        const dist = Math.hypot(player.sprite.x - tx, player.sprite.y - ty);
        if (dist <= radius) {
          player.takeDamage(Math.round(this.damage * 1.35), performance.now());
        }
      }
    });
  }

  updateDecor(timeMs) {
    if (!this.decorGfx || !this.decorGfx.active || !this.sprite || !this.sprite.active) return;
    super.updateDecor(timeMs);

    const g = this.decorGfx;
    const sc = this.baseScale || 2.0;
    const footY = 28 * sc;

    // Milestone Apex Boss gets a radiant rotating multi-ring apex runic seal
    if (this.isMilestoneBoss) {
      const rot = (timeMs / 1000) * 1.8;
      const r1 = 44 * sc;
      const r2 = 54 * sc;
      g.lineStyle(2, 0xf59e0b, 0.85);
      g.strokeCircle(0, footY, r1);
      g.lineStyle(1.5, 0xef4444, 0.7);
      g.strokeCircle(0, footY, r2);

      // 6 Rotating runic teeth
      for (let i = 0; i < 6; i++) {
        const a = rot + (i * Math.PI) / 3;
        const x1 = Math.cos(a) * (r1 - 4);
        const y1 = footY + Math.sin(a) * (r1 - 4);
        const x2 = Math.cos(a) * (r2 + 4);
        const y2 = footY + Math.sin(a) * (r2 + 4);
        g.lineBetween(x1, y1, x2, y2);
      }
    }
  }
}

export default Boss;
