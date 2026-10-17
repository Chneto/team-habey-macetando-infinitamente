import { getCharacterById } from '../config/charactersData.js';
import {
  PASSIVE_SKILLS,
  SYNERGY_EVOLUTIONS,
  DUAL_FUSIONS,
  getXpRequiredForLevel,
  getSkillById
} from '../config/skillsData.js';
import AnimationSystem from '../systems/AnimationSystem.js';
import saveManager from '../systems/SaveManager.js';
import soundManager from '../systems/SoundManager.js';

export class Player {
  constructor(scene, x, y, characterId = 'petrus') {
    this.scene = scene;
    this.characterData = getCharacterById(characterId);
    this.talentBonuses = saveManager.getTalentBonuses();

    this.sprite = scene.physics.add.sprite(x, y, this.characterData.spriteKey, 0);
    this.sprite.setDepth(15);
    this.sprite.body.setSize(28, 34);
    this.sprite.body.setOffset(18, 18);

    // Core Stats
    this.level = 1;
    this.xp = 0;
    this.xpToNext = getXpRequiredForLevel(1);
    this.kills = 0;
    this.goldEarned = 0;

    // Derived Combat & Movement Modifiers
    this.limitBreakBonuses = {
      damageMult: 0,
      areaMult: 0,
      cooldownReduction: 0
    };

    this.maxHp = Math.round(this.characterData.stats.hp);
    this.hp = this.maxHp;
    this.isDead = false;
    this.isGodMode = false;

    // Invincibility & Shields
    this.invincibleUntil = 0;
    this.barrierCharges = 0;
    this.fairyShieldHp = 0;
    this.gemsCollectedCount = 0;
    this.cumulativeHpLost = 0;

    // Temporary Buffs (from Chests & Pets)
    this.furyBuffUntil = 0;
    this.seismicBuffUntil = 0;

    // Dash & Stamina
    this.maxDashCharges =
      1 +
      (this.characterData.stats.extraDashCharges || 0) +
      (this.talentBonuses.extraDashCharges || 0);
    this.dashCharges = this.maxDashCharges;
    this.dashRechargeProgress = 0;
    this.baseDashCooldownMs = 2800 * (this.characterData.stats.dashCooldownMult || 1.0);
    this.isDashing = false;
    this.dashUntil = 0;
    this.dashVx = 0;
    this.dashVy = 0;
    this.lastMoveDir = { x: 1, y: 0 };
    this.voltWalkCharge = 0;

    // Petrus 4-Arm Rigging & Innate Counter
    this.attackCounter = 0;
    this.fourArms = this.characterData.hasFourArms
      ? AnimationSystem.createPetrusFourArms(scene, x, y)
      : [];
    this.traitLayer = AnimationSystem.createCharacterTraitLayer(scene, this.characterData, x, y);

    // Spectral Clones (1 to 3 levels from Talent Shop)
    this.clones = [];
    this.createSpectralClones();

    // 5 Active Slots + 5 Passive Slots
    this.activeSkills = new Map();
    this.passiveSkills = new Map();
    this.consumedSkills = new Set();
    this.banishedSkills = new Set();

    // Rerolls
    this.rerollsRemaining = 2 + (this.characterData.stats.extraRerolls || 0);
    this.banishesRemaining = 2;

    // Equip starter weapon in Slot 1
    this.addOrUpgradeActiveSkill(this.characterData.starterSkillId, 1);
    this.recalculateStats();
  }

  createSpectralClones() {
    const count = this.talentBonuses.cloneCount || 0;
    const offsets = [
      { ox: -48, oy: 26 },
      { ox: 48, oy: 26 },
      { ox: 0, oy: -52 }
    ];
    for (let i = 0; i < count; i++) {
      const off = offsets[i % offsets.length];
      const cloneSprite = this.scene.add.sprite(
        this.sprite.x + off.ox,
        this.sprite.y + off.oy,
        this.characterData.spriteKey,
        0
      );
      cloneSprite.setDepth(14);
      cloneSprite.setAlpha(0.55);
      cloneSprite.setTint(0x38bdf8);
      this.clones.push({
        sprite: cloneSprite,
        ox: off.ox,
        oy: off.oy
      });
    }
  }

  recalculateStats() {
    const base = this.characterData.stats;
    const tb = this.talentBonuses;
    const lb = this.limitBreakBonuses;

    const getPassiveLvl = (id) => this.passiveSkills.get(id)?.level || 0;
    // Also include absorbed passives from Synergy Evolutions
    const hasEvolvedPassive = (passiveId) => {
      for (const slot of this.activeSkills.values()) {
        if (slot.data.passiveId === passiveId) return 5;
      }
      return 0;
    };
    const effPassiveLvl = (id) => Math.max(getPassiveLvl(id), hasEvolvedPassive(id));

    const prevMaxHp = this.maxHp;
    this.maxHp = Math.round(base.hp + effPassiveLvl('dragon_heart') * 22);
    if (this.maxHp > prevMaxHp) {
      this.hp += this.maxHp - prevMaxHp;
    }

    const dupLvl = effPassiveLvl('duplicator_crystal');
    const dupEvenBonus = Math.floor(dupLvl / 2) * 0.12;

    this.damageMult =
      base.damageMult *
      (1 + tb.damageMult + lb.damageMult + effPassiveLvl('titan_glove') * 0.12 + dupEvenBonus);

    this.areaMult =
      base.areaMult *
      (1 + lb.areaMult + effPassiveLvl('reach_ring') * 0.12);

    this.critChance = Math.min(
      0.95,
      base.critChance + effPassiveLvl('hawk_eye') * 0.07
    );
    this.critDamageMult = 1.65 + effPassiveLvl('hawk_eye') * 0.15;

    this.cooldownReduction = Math.min(
      0.72,
      (base.cooldownReduction || 0) +
        tb.cooldownReduction +
        lb.cooldownReduction +
        effPassiveLvl('wisdom_tome') * 0.08
    );

    const dupBonusProj = dupLvl >= 5 ? 3 : dupLvl >= 3 ? 2 : dupLvl >= 1 ? 1 : 0;
    this.extraProjectiles = tb.extraProjectiles + dupBonusProj;

    const hermesLvl = effPassiveLvl('hermes_boots');
    this.moveSpeed =
      195 *
      base.speedMult *
      (1 + tb.moveSpeedMult + hermesLvl * 0.09);

    this.baseDashCooldownMs =
      2800 *
      (base.dashCooldownMult || 1.0) *
      Math.max(0.45, 1 - hermesLvl * 0.06);

    this.pickupRadius =
      95 *
      base.pickupRadiusMult *
      (1 + effPassiveLvl('astral_magnet') * 0.25);

    this.regenPerSec = (base.regenPerSec || 0) + effPassiveLvl('dragon_heart') * 1.2;

    this.durationMult = 1 + effPassiveLvl('eternal_hourglass') * 0.15;

    this.projectileSpeedMult =
      (base.projectileSpeedMult || 1.0) *
      (1 + effPassiveLvl('kinetic_accelerator') * 0.15);

    this.knockbackMult =
      base.knockbackMult * (1 + effPassiveLvl('kinetic_accelerator') * 0.10);

    this.xpGoldMult =
      (base.xpBonusMult || 1.0) * (1 + effPassiveLvl('crown_of_greed') * 0.14);

    this.luckMult =
      (base.luckMult || 1.0) +
      tb.luckMult +
      effPassiveLvl('crown_of_greed') * 0.05;

    this.thornArmorLevel = effPassiveLvl('thorn_armor');
    this.armor = Math.min(
      0.75,
      (base.armor || 0) + this.thornArmorLevel * 0.06
    );
  }

  addOrUpgradeActiveSkill(skillId, levelDelta = 1) {
    const existing = this.activeSkills.get(skillId);
    if (existing) {
      existing.level = Math.min(5, existing.level + levelDelta);
      this.recalculateStats();
      return existing;
    }

    if (this.activeSkills.size >= 5) return null;
    const data = getSkillById(skillId);
    if (!data) return null;

    const entry = {
      id: skillId,
      level: Math.min(5, Math.max(1, levelDelta)),
      data,
      isEvolution: Boolean(data.type === 'evolution' || data.type === 'fusion'),
      cooldownTimer: 150,
      totalDamage: 0
    };
    this.activeSkills.set(skillId, entry);
    saveManager.discoverItem(skillId);
    this.recalculateStats();
    return entry;
  }

  addOrUpgradePassiveSkill(passiveId, levelDelta = 1) {
    const existing = this.passiveSkills.get(passiveId);
    if (existing) {
      existing.level = Math.min(5, existing.level + levelDelta);
      this.recalculateStats();
      return existing;
    }

    if (this.passiveSkills.size >= 5) return null;
    const data = PASSIVE_SKILLS.find((p) => p.id === passiveId);
    if (!data) return null;

    const entry = {
      id: passiveId,
      level: Math.min(5, Math.max(1, levelDelta)),
      data
    };
    this.passiveSkills.set(passiveId, entry);
    saveManager.discoverItem(passiveId);
    this.recalculateStats();
    return entry;
  }

  /**
   * Checks if any Active+Passive Evolution or Active+Active Fusion is ready
   */
  getAvailableEvolutionsAndFusions() {
    const ready = [];

    for (const fus of DUAL_FUSIONS) {
      if (this.activeSkills.has(fus.id) || this.consumedSkills.has(fus.id)) continue;
      const a = this.activeSkills.get(fus.activeAId);
      const b = this.activeSkills.get(fus.activeBId);
      if (a && a.level >= 5 && b && b.level >= 5) {
        ready.push({ kind: 'fusion', recipe: fus });
      }
    }

    for (const evo of SYNERGY_EVOLUTIONS) {
      if (this.activeSkills.has(evo.id) || this.consumedSkills.has(evo.id)) continue;
      const a = this.activeSkills.get(evo.activeId);
      const p = this.passiveSkills.get(evo.passiveId);
      if (a && a.level >= 5 && p && p.level >= 5) {
        ready.push({ kind: 'evolution', recipe: evo });
      }
    }

    return ready;
  }

  applyEvolutionOrFusion(recipe) {
    if (recipe.type === 'fusion') {
      const dmgA = this.activeSkills.get(recipe.activeAId)?.totalDamage || 0;
      const dmgB = this.activeSkills.get(recipe.activeBId)?.totalDamage || 0;
      this.activeSkills.delete(recipe.activeAId);
      this.activeSkills.delete(recipe.activeBId);
      this.consumedSkills.add(recipe.activeAId);
      this.consumedSkills.add(recipe.activeBId);

      const entry = {
        id: recipe.id,
        level: 5,
        data: recipe,
        isEvolution: true,
        cooldownTimer: 100,
        totalDamage: dmgA + dmgB
      };
      this.activeSkills.set(recipe.id, entry);
      saveManager.discoverItem(recipe.id);
      saveManager.unlockAchievement('fusion_archon');
      soundManager.playEvolution();
      this.recalculateStats();
      return entry;
    }

    if (recipe.type === 'evolution') {
      const prevDmg = this.activeSkills.get(recipe.activeId)?.totalDamage || 0;
      this.activeSkills.delete(recipe.activeId);
      this.passiveSkills.delete(recipe.passiveId);
      this.consumedSkills.add(recipe.activeId);
      this.consumedSkills.add(recipe.passiveId);

      const entry = {
        id: recipe.id,
        level: 5,
        data: recipe,
        isEvolution: true,
        cooldownTimer: 100,
        totalDamage: prevDmg
      };
      this.activeSkills.set(recipe.id, entry);
      saveManager.discoverItem(recipe.id);
      saveManager.unlockAchievement('synergy_master');
      soundManager.playEvolution();
      this.recalculateStats();
      return entry;
    }

    return null;
  }

  tryDash(timeMs) {
    if (this.isDead || this.isDashing || this.dashCharges < 1) return false;

    this.dashCharges -= 1;
    this.isDashing = true;
    this.dashUntil = timeMs + 230;
    this.invincibleUntil = Math.max(this.invincibleUntil, timeMs + 340);

    const len = Math.hypot(this.lastMoveDir.x, this.lastMoveDir.y) || 1;
    const dashSpeed = this.moveSpeed * 3.1;
    this.dashVx = (this.lastMoveDir.x / len) * dashSpeed;
    this.dashVy = (this.lastMoveDir.y / len) * dashSpeed;

    soundManager.playDash();

    // Volt's Innate Passive: Passo Relâmpago
    if (this.characterData.id === 'volt' && this.scene.combatSystem) {
      this.scene.combatSystem.triggerVoltDashDischarge(this.sprite.x, this.sprite.y);
      this.voltWalkCharge = 0;
    }

    return true;
  }

  takeDamage(rawDamage, timeMs = performance.now()) {
    if (this.isDead || this.isGodMode || this.isDashing || timeMs < this.invincibleUntil) {
      return 0;
    }

    // Nyx Horizon Hunger barrier check
    if (this.barrierCharges > 0) {
      this.barrierCharges -= 1;
      this.invincibleUntil = timeMs + 500;
      this.scene.combatSystem?.spawnFloatingText(this.sprite.x, this.sprite.y - 24, 'BARREIRA!', '#c084fc');
      return 0;
    }

    // Light Fairy Shield check
    if (this.fairyShieldHp > 0) {
      const absorbed = Math.min(this.fairyShieldHp, rawDamage);
      this.fairyShieldHp -= absorbed;
      rawDamage -= absorbed;
      if (this.fairyShieldHp <= 0) {
        this.scene.combatSystem?.triggerFairyShieldExplosion(
          this.sprite.x,
          this.sprite.y,
          this.fairyShieldPetRef || null
        );
      }
      if (rawDamage <= 0) {
        this.invincibleUntil = timeMs + 500;
        return 0;
      }
    }

    const reduced = Math.max(1, Math.round(rawDamage * (1 - this.armor)));
    this.hp = Math.max(0, this.hp - reduced);
    this.invincibleUntil = timeMs + 500; // 0.5s i-frames

    AnimationSystem.triggerHitFlash(this.scene, this);

    // Armadura de Espinhos: reflects seismic damage to nearby attackers
    if (this.thornArmorLevel > 0) {
      const thornDmg = Math.round((18 + this.thornArmorLevel * 12) * this.damageMult);
      this.scene.combatSystem?.damageEnemiesInRadius(this.sprite.x, this.sprite.y, 115, thornDmg, {
        element: 'earth',
        knockback: 140
      });
    }

    // Solarius Innate Passive: Égide Radiante (every 20% max HP lost)
    if (this.characterData.id === 'solarius') {
      this.cumulativeHpLost += reduced;
      const threshold = this.maxHp * 0.20;
      if (this.cumulativeHpLost >= threshold && this.hp > 0) {
        this.cumulativeHpLost = 0;
        this.heal(Math.round(this.maxHp * 0.10));
        this.scene.combatSystem?.triggerSolariusSupernova(this.sprite.x, this.sprite.y);
      }
    }

    if (this.hp <= 0) {
      this.isDead = true;
      this.scene.handleGameOver();
    }

    return reduced;
  }

  heal(amount) {
    if (this.isDead || amount <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  gainXp(rawXp) {
    if (this.isDead) return;
    const gained = Math.max(1, Math.round(rawXp * this.xpGoldMult));
    this.xp += gained;

    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = getXpRequiredForLevel(this.level);
      this.scene.queueLevelUp();
    }
  }

  gainInstantLevels(count = 1) {
    if (this.isDead || count <= 0) return;
    for (let i = 0; i < count; i++) {
      this.level += 1;
      this.xpToNext = getXpRequiredForLevel(this.level);
      this.scene.queueLevelUp();
    }
  }

  onGemCollected() {
    this.gemsCollectedCount += 1;
    // Nyx Innate Passive: every 25 gems grants 1 barrier charge
    if (this.characterData.id === 'nyx' && this.gemsCollectedCount % 25 === 0) {
      this.barrierCharges = Math.min(3, this.barrierCharges + 1);
      this.scene.combatSystem?.spawnFloatingText(this.sprite.x, this.sprite.y - 28, '+ESCUDOS DO VAZIO', '#a855f7');
    }
  }

  update(timeMs, deltaMs, inputVec) {
    if (this.isDead) {
      this.sprite.body.setVelocity(0, 0);
      return;
    }

    const dtSec = deltaMs / 1000;

    // HP Regeneration
    if (this.regenPerSec > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.regenPerSec * dtSec);
    }

    // Stamina / Dash Charge Recovery
    if (this.dashCharges < this.maxDashCharges) {
      const regenMult = 1 + (this.talentBonuses.staminaRegenMult || 0);
      this.dashRechargeProgress += deltaMs * regenMult;
      if (this.dashRechargeProgress >= this.baseDashCooldownMs) {
        this.dashRechargeProgress -= this.baseDashCooldownMs;
        this.dashCharges = Math.min(this.maxDashCharges, this.dashCharges + 1);
      }
    }

    let vx = 0;
    let vy = 0;

    if (this.isDashing) {
      if (timeMs >= this.dashUntil) {
        this.isDashing = false;
      } else {
        vx = this.dashVx;
        vy = this.dashVy;
        // Spawn ghost afterimage every ~45ms
        if (Math.random() < 0.45) {
          const ghost = this.scene.add.sprite(this.sprite.x, this.sprite.y, this.characterData.spriteKey, 1);
          ghost.setDepth(13);
          ghost.setAlpha(0.45 * saveManager.getVfxOpacity());
          ghost.setTint(this.characterData.accentColor);
          ghost.setFlipX(this.sprite.flipX);
          this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 180,
            onComplete: () => ghost.destroy()
          });
        }
      }
    } else {
      const len = Math.hypot(inputVec.x, inputVec.y);
      if (len > 0.05) {
        const nx = inputVec.x / len;
        const ny = inputVec.y / len;
        this.lastMoveDir.x = nx;
        this.lastMoveDir.y = ny;
        vx = nx * this.moveSpeed;
        vy = ny * this.moveSpeed;

        if (this.characterData.id === 'volt') {
          this.voltWalkCharge = Math.min(100, this.voltWalkCharge + dtSec * 25);
        }
      }
    }

    this.sprite.body.setVelocity(vx, vy);
    AnimationSystem.updateLocomotion(this.sprite, vx, vy, timeMs, 1.0, 0);
    AnimationSystem.updateCharacterTraitLayer(
      this.traitLayer,
      this.sprite.x,
      this.sprite.y,
      vx,
      vy,
      timeMs,
      this
    );

    if (this.traitLayer?.gfx?.active) {
      if (this.barrierCharges > 0) {
        this.traitLayer.gfx.lineStyle(2, 0xc084fc, 0.85);
        this.traitLayer.gfx.strokeCircle(0, 0, 29);
      }
      if (this.fairyShieldHp > 0) {
        this.traitLayer.gfx.lineStyle(2, 0xfde047, 0.85);
        this.traitLayer.gfx.strokeCircle(0, 0, 32);
      }
    }

    // Update Petrus's 4 independent floating stone arms
    if (this.fourArms.length > 0) {
      const nearest = this.scene.combatSystem?.findNearestEnemy(this.sprite.x, this.sprite.y, 480);
      AnimationSystem.updatePetrusFourArms(
        this.fourArms,
        this.sprite.x,
        this.sprite.y,
        timeMs,
        nearest ? nearest.sprite.x : null,
        nearest ? nearest.sprite.y : null
      );
    }

    // Update Spectral Clones in formation
    for (let i = 0; i < this.clones.length; i++) {
      const clone = this.clones[i];
      const targetX = this.sprite.x + clone.ox;
      const targetY = this.sprite.y + clone.oy;
      clone.sprite.x += (targetX - clone.sprite.x) * 0.18;
      clone.sprite.y += (targetY - clone.sprite.y) * 0.18;
      AnimationSystem.updateLocomotion(clone.sprite, vx, vy, timeMs, 0.9, i + 1);
    }
  }
}

export default Player;
