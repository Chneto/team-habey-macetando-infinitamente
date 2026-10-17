import AnimationSystem from '../systems/AnimationSystem.js';
import saveManager from '../systems/SaveManager.js';

export class Pet {
  constructor(scene, player, petData, index = 0) {
    this.scene = scene;
    this.player = player;
    this.petData = petData;
    this.index = index;
    this.totalDamage = 0;

    const angle = (index * Math.PI * 2) / 5;
    const x = player.sprite.x + Math.cos(angle) * 52;
    const y = player.sprite.y + Math.sin(angle) * 52;

    this.sprite = scene.add.sprite(x, y, petData.spriteKey, 0);
    this.sprite.setDepth(16);

    this.cooldownTimer = 600 + index * 120;
    this.orbitAngle = angle;
    this.hitCounter = 0;
    this.focusedTarget = null;
    this.focusDurationSec = 0;
  }

  getPowerMultiplier() {
    let mult = 1.0 + (this.player.talentBonuses?.petPowerMult || 0);
    if (this.player.characterData.id === 'sylas') {
      mult *= 1.35; // Sylas Senhor da Matilha +35%
    }
    return mult;
  }

  getAttackSpeedMultiplier() {
    return this.player.characterData.id === 'sylas' ? 1.35 : 1.0;
  }

  update(timeMs, deltaMs) {
    if (!this.sprite || !this.sprite.active || this.player.isDead) return;

    const dtSec = deltaMs / 1000;
    this.orbitAngle += dtSec * (this.petData.id === 'stone_golem_pet' ? 2.6 : 1.4);

    const radius = this.petData.id === 'stone_golem_pet' ? 62 : 48 + (this.index % 3) * 14;
    let targetX = this.player.sprite.x + Math.cos(this.orbitAngle) * radius;
    let targetY = this.player.sprite.y + Math.sin(this.orbitAngle) * radius;

    // Collector Imp chases nearest uncollected gem within 260px
    if (this.petData.id === 'collector_imp' && this.scene.gemManager) {
      const gem = this.scene.gemManager.findNearestGem(this.sprite.x, this.sprite.y, 260);
      if (gem) {
        targetX = gem.x;
        targetY = gem.y;
        const distGem = Math.hypot(gem.x - this.sprite.x, gem.y - this.sprite.y);
        if (distGem < 28) {
          this.scene.gemManager.collectGem(gem);
        }
      }
    }

    const vx = (targetX - this.sprite.x) * 6;
    const vy = (targetY - this.sprite.y) * 6;
    this.sprite.x += (targetX - this.sprite.x) * 0.14;
    this.sprite.y += (targetY - this.sprite.y) * 0.14;

    AnimationSystem.updateLocomotion(this.sprite, vx, vy, timeMs, 1.0, this.index);

    // Stone Golem Pet blocks enemy projectiles near its body
    if (this.petData.id === 'stone_golem_pet' && this.scene.combatSystem) {
      this.scene.combatSystem.blockEnemyProjectilesNear(this.sprite.x, this.sprite.y, 34);
    }

    // Track Arcane Owl focus target
    if (this.petData.id === 'arcane_owl' && this.focusedTarget && !this.focusedTarget.isDead) {
      this.focusDurationSec += dtSec;
    } else {
      this.focusDurationSec = 0;
    }

    this.cooldownTimer -= deltaMs * this.getAttackSpeedMultiplier();
    if (this.cooldownTimer <= 0) {
      this.cooldownTimer = this.petData.cooldown;
      this.performAction(timeMs);
    }
  }

  performAction(timeMs) {
    const cs = this.scene.combatSystem;
    if (!cs) return;

    const powerMult = this.getPowerMultiplier();
    const baseDmg = Math.round(this.petData.baseDamage * powerMult * this.player.damageMult);

    switch (this.petData.id) {
      case 'light_fairy': {
        this.player.heal(Math.round(this.player.maxHp * 0.08 + 6));
        if (this.player.fairyShieldHp > 0) {
          cs.triggerFairyShieldExplosion(this.player.sprite.x, this.player.sprite.y, this);
        }
        this.player.fairyShieldHp = Math.round(35 * powerMult);
        this.player.fairyShieldPetRef = this;
        cs.spawnFloatingText(this.player.sprite.x, this.player.sprite.y - 32, '+CURA & ESCUDO', '#fef08a');
        break;
      }

      case 'crimson_drake': {
        const target = cs.findDenseClusterEnemy(this.sprite.x, this.sprite.y, 460);
        if (target) {
          AnimationSystem.playCastAnimation(this.sprite);
          cs.firePetProjectile(this, target.sprite.x, target.sprite.y, baseDmg, 'fire', 95);
        }
        break;
      }

      case 'arcane_owl': {
        const target = cs.findHighestHpEnemy(this.sprite.x, this.sprite.y, 580);
        if (target) {
          if (this.focusedTarget !== target) {
            this.focusedTarget = target;
            this.focusDurationSec = 0;
          }
          const focusBonus = 1 + this.focusDurationSec * 0.02;
          const owlDmg = Math.round(baseDmg * focusBonus);
          AnimationSystem.playCastAnimation(this.sprite);
          cs.fireBeamStrike(this.sprite.x, this.sprite.y, target.sprite.x, target.sprite.y, owlDmg, 'ice', this);
        }
        break;
      }

      case 'stone_golem_pet': {
        const target = cs.findNearestEnemy(this.sprite.x, this.sprite.y, 180);
        if (target) {
          this.hitCounter += 1;
          cs.dealDamageToEnemy(target, baseDmg, {
            element: 'earth',
            knockback: 180,
            fromX: this.sprite.x,
            fromY: this.sprite.y,
            petRef: this
          });

          if (this.hitCounter % 5 === 0) {
            this.player.seismicBuffUntil = timeMs + 5000;
            cs.triggerAoEExplosion(this.sprite.x, this.sprite.y, 145, Math.round(baseDmg * 1.5), 'earth', {
              slowPct: 0.40,
              petRef: this
            });
            cs.spawnFloatingText(this.player.sprite.x, this.player.sprite.y - 36, '+50% DANO SÍSMICO!', '#f59e0b');
          }
        }
        break;
      }

      case 'collector_imp': {
        const target = cs.findNearestEnemy(this.sprite.x, this.sprite.y, 380);
        if (target) {
          cs.firePetProjectile(this, target.sprite.x, target.sprite.y, baseDmg, 'poison', 0);
        }
        break;
      }

      case 'spirit_wolf': {
        const target = cs.findNearestEnemy(this.sprite.x, this.sprite.y, 400);
        if (target) {
          const line = this.scene.add.line(
            0,
            0,
            this.sprite.x,
            this.sprite.y,
            target.sprite.x,
            target.sprite.y,
            0x10b981,
            0.7 * saveManager.getVfxOpacity()
          ).setOrigin(0, 0).setDepth(14);
          this.scene.tweens.add({
            targets: line,
            alpha: 0,
            duration: 160,
            onComplete: () => line.destroy()
          });
          cs.dealDamageToEnemy(target, baseDmg, {
            element: 'wind',
            knockback: 85,
            fromX: this.sprite.x,
            fromY: this.sprite.y,
            petRef: this
          });
        }
        break;
      }
    }
  }

  destroy() {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
  }
}

export default Pet;
