import {
  ENEMY_TYPES,
  HORDE_EVENTS,
  MINI_BOSS_TEMPLATES,
  MAIN_BOSS_TEMPLATES,
  PETS_DATA,
  CHEST_DROP_ITEMS
} from '../config/enemiesData.js';
import { ELEMENTS } from '../config/elementsData.js';
import Enemy from '../entities/Enemy.js';
import Boss from '../entities/Boss.js';
import Pet from '../entities/Pet.js';
import saveManager from './SaveManager.js';
import soundManager from './SoundManager.js';

export class SpawnSystem {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.chests = [];
    this.cages = [];
    this.hazards = [];
    this.pets = [];

    this.spawnTimer = 400;
    this.chestTimer = 18000;
    this.cageTimer = 26000;
    this.hazardTimer = 14000;

    this.triggeredHordeKeys = new Set();
    this.nextMiniBossSec = 60; // 1.0 minute (fast-paced action)
    this.miniBossIntervalSec = 75; // every 75s after
    this.nextMainBossSec = 150; // 2.5 minutes (first main boss)
    this.mainBossIntervalSec = 150; // every 150s after
    this.miniBossIndex = 0;
    this.mainBossIndex = 0;
    this.lastMilestoneBossLevel = 0;
    this.milestoneBossIndex = 0;
  }

  initStarterPets(player) {
    // Sylas starts the run with his exclusive Spirit Wolf pet
    if (player.characterData.startsWithSpiritWolf) {
      const wolfData = PETS_DATA.find((p) => p.id === 'spirit_wolf');
      if (wolfData) {
        this.pets.push(new Pet(this.scene, player, wolfData, 0));
      }
    }
  }

  getMaxPetsAllowed(player) {
    return (
      2 +
      (player.characterData.stats.petLimitBonus || 0) +
      (player.talentBonuses?.petLimitBonus || 0)
    );
  }

  update(timeMs, deltaMs, player, runSeconds) {
    if (!player || player.isDead) return;

    const minuteT = runSeconds / 60;
    const killsK = player.kills;

    // 1. Check Chest Proximity (< 400px lights up rune circle & spawns extra guardians)
    let nearChestMultiplier = 1.0;
    for (const chest of this.chests) {
      if (!chest.active) continue;
      const dist = Math.hypot(player.sprite.x - chest.x, player.sprite.y - chest.y);
      const isClose = dist < 400;
      chest.runeCircle.setVisible(isClose);
      if (isClose) {
        chest.runeCircle.rotation += (deltaMs / 1000) * 1.5;
        nearChestMultiplier = 1.85;
      }
    }

    // 2. Regular Mob Spawning (fast, dynamic bullet-heaven pressure)
    this.spawnTimer -= deltaMs * nearChestMultiplier;
    if (this.spawnTimer <= 0 && this.enemies.length < 220) {
      const baseInterval = Math.max(130, 480 - minuteT * 50);
      this.spawnTimer = baseInterval;

      const batchCount = nearChestMultiplier > 1 ? 4 : minuteT >= 1 ? 3 : 2;
      for (let i = 0; i < batchCount; i++) {
        this.spawnRandomMobAroundPlayer(player, minuteT, killsK);
      }
    }

    // 3. Dynamic Horde Events (triggering every 45s so combat stays intense and varied)
    const hordeStep = Math.floor(runSeconds / 45);
    if (hordeStep > 0) {
      const key = `horde_step_${hordeStep}`;
      if (!this.triggeredHordeKeys.has(key)) {
        this.triggeredHordeKeys.add(key);
        const hordeEvent = HORDE_EVENTS[(hordeStep - 1) % HORDE_EVENTS.length];
        this.triggerHordeEvent(hordeEvent, player, minuteT, killsK);
      }
    }

    // 4. Mini-Bosses (every 75s after 1m) & Main Bosses (every 2.5m)
    if (runSeconds >= this.nextMiniBossSec) {
      this.nextMiniBossSec += this.miniBossIntervalSec;
      this.spawnMiniBossNow();
    }
    if (runSeconds >= this.nextMainBossSec) {
      this.nextMainBossSec += this.mainBossIntervalSec;
      this.spawnMainBossNow();
    }

    // 5. Decennial Milestone Apex Boss (spawns every 10 player levels: Lv.10, 20, 30...)
    if (player.level >= 10 && player.level % 10 === 0 && player.level > this.lastMilestoneBossLevel) {
      this.lastMilestoneBossLevel = player.level;
      this.spawnMilestoneBossNow(player, player.level);
    }

    // 5. Periodic Chests, Pet Cages & Environmental Hazards
    this.chestTimer -= deltaMs;
    if (this.chestTimer <= 0 && this.chests.length < 3) {
      this.chestTimer = 24000;
      this.spawnTreasureChestAtRandom(player);
    }

    this.cageTimer -= deltaMs;
    if (this.cageTimer <= 0 && this.cages.length < 2 && this.pets.length < this.getMaxPetsAllowed(player)) {
      this.cageTimer = 32000;
      this.spawnPetCageAtRandom(player);
    }

    this.hazardTimer -= deltaMs;
    if (this.hazardTimer <= 0 && this.hazards.length < 3) {
      this.hazardTimer = 16000;
      this.spawnEnvironmentalHazard(player);
    }

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      if (!hz || !hz.active) continue;
      hz.elapsedMs += deltaMs;
      if (hz.innerRing) {
        const progress = Math.min(1, hz.elapsedMs / hz.fuseMs);
        hz.innerRing.setScale(0.15 + progress * 0.85);
        hz.innerRing.setAlpha(0.2 + progress * 0.55);
      }
      if (hz.elapsedMs >= hz.fuseMs) {
        this.detonateHazard(i);
      }
    }

    // 6. Update Enemies & Contact Damage
    const px = player.sprite.x;
    const py = player.sprite.y;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e || e.isDead || !e.sprite?.active) {
        this.enemies.splice(i, 1);
        continue;
      }
      e.update(timeMs, deltaMs, player);

      if (e.isDead || !e.sprite?.active) {
        continue;
      }

      const dist = Math.hypot(e.sprite.x - px, e.sprite.y - py);
      const hitDist = e.isBoss ? 38 : e.isMiniBoss ? 32 : 24;
      if (dist < hitDist) {
        player.takeDamage(e.damage, timeMs);
      }
    }

    // 7. Update Autonomous Pets
    for (const pet of this.pets) {
      pet.update(timeMs, deltaMs);
    }
  }

  spawnRandomMobAroundPlayer(player, minuteT, killsK) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 540 + Math.random() * 140;
    const x = player.sprite.x + Math.cos(angle) * dist;
    const y = player.sprite.y + Math.sin(angle) * dist;

    const poolMax = Math.min(ENEMY_TYPES.length, 2 + Math.floor(minuteT));
    const typeData = ENEMY_TYPES[Math.floor(Math.random() * poolMax)];
    return this.spawnEnemyAt(x, y, typeData, minuteT, killsK);
  }

  spawnEnemyAt(x, y, typeData = null, minuteT = null, killsK = null, extraConfig = {}) {
    let effMinute = minuteT;
    let effExtra = extraConfig;
    if (typeof minuteT === 'object' && minuteT !== null) {
      effExtra = minuteT;
      effMinute = null;
    }
    const resolvedType = typeData || ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)] || ENEMY_TYPES[0];
    const T = effMinute ?? this.scene.runSeconds / 60;
    const K = killsK ?? (this.scene.player?.kills || 0);
    const enemy = new Enemy(this.scene, x, y, resolvedType, T, K, effExtra);
    this.enemies.push(enemy);
    return enemy;
  }

  triggerHordeEvent(eventData, player, minuteT, killsK) {
    this.scene.uiManager?.showBanner(`⚠️ EVENTO DE HORDA: ${eventData.name.toUpperCase()}!`, eventData.bannerColor);
    const px = player.sprite.x;
    const py = player.sprite.y;
    const enemyType = ENEMY_TYPES.find((e) => e.id === eventData.enemyId) || ENEMY_TYPES[0];

    if (eventData.id === 'iron_ring') {
      // 60 golems & squires in a closed ring contracting slowly
      const count = Math.min(60, Math.max(24, 180 - this.enemies.length));
      const radius = 520;
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count;
        this.spawnEnemyAt(
          px + Math.cos(ang) * radius,
          py + Math.sin(ang) * radius,
          enemyType,
          minuteT,
          killsK,
          { speedMult: 0.55, hpMult: 1.25 }
        );
      }
    } else if (eventData.id === 'lightning_stampede') {
      // Red warning lanes on ground followed by ultra-fast stampede
      for (let lane = -2; lane <= 2; lane++) {
        const ly = py + lane * 85;
        const rect = this.scene.add.rectangle(px, ly, 1200, 36, 0xef4444, 0.25).setDepth(3);
        this.scene.tweens.add({
          targets: rect,
          alpha: 0.05,
          yoyo: true,
          repeat: 2,
          duration: 240,
          onComplete: () => {
            rect.destroy();
            for (let k = 0; k < 5; k++) {
              this.spawnEnemyAt(px - 620 - k * 55, ly, enemyType, minuteT, killsK, {
                stampedeVelocity: { vx: 340, vy: 0 }
              });
            }
          }
        });
      }
    } else if (eventData.id === 'elemental_convergence') {
      const elemKeys = Object.keys(ELEMENTS);
      const chosenElem = elemKeys[Math.floor(Math.random() * elemKeys.length)];
      const elemColor = ELEMENTS[chosenElem].color;
      for (let i = 0; i < 28; i++) {
        const ang = (Math.PI * 2 * i) / 28;
        this.spawnEnemyAt(
          px + Math.cos(ang) * 480,
          py + Math.sin(ang) * 480,
          enemyType,
          minuteT,
          killsK,
          { imbuedElement: chosenElem, imbuedColor: elemColor }
        );
      }
    } else if (eventData.id === 'shadow_siege') {
      for (let i = 0; i < 24; i++) {
        const ang = i * 0.55;
        const dist = 340 + i * 12;
        this.spawnEnemyAt(
          px + Math.cos(ang) * dist,
          py + Math.sin(ang) * dist,
          enemyType,
          minuteT,
          killsK
        );
      }
    }
  }

  spawnMiniBossNow() {
    const player = this.scene.player;
    if (!player) return null;
    const template = MINI_BOSS_TEMPLATES[this.miniBossIndex % MINI_BOSS_TEMPLATES.length];
    this.miniBossIndex += 1;

    const angle = Math.random() * Math.PI * 2;
    const x = player.sprite.x + Math.cos(angle) * 340;
    const y = player.sprite.y + Math.sin(angle) * 340;
    const minuteT = this.scene.runSeconds / 60;

    const miniBoss = new Boss(this.scene, x, y, template, minuteT, player.kills, false);
    this.enemies.push(miniBoss);
    soundManager.playBossSpawn();
    this.scene.setBossAtmosphere(true, false);
    this.scene.uiManager?.showBanner(`👹 MINI-BOSS: ${template.name}!`, '#f97316');
    return miniBoss;
  }

  spawnMainBossNow() {
    const player = this.scene.player;
    if (!player) return null;
    const template = MAIN_BOSS_TEMPLATES[this.mainBossIndex % MAIN_BOSS_TEMPLATES.length];
    this.mainBossIndex += 1;

    const angle = Math.random() * Math.PI * 2;
    const x = player.sprite.x + Math.cos(angle) * 360;
    const y = player.sprite.y + Math.sin(angle) * 360;
    const minuteT = this.scene.runSeconds / 60;

    const boss = new Boss(this.scene, x, y, template, minuteT, player.kills, true);
    this.enemies.push(boss);

    // Lock the main game clock until the Main Boss is defeated!
    this.scene.isTimerLockedByBoss = true;
    this.scene.setBossAtmosphere(true, true);
    soundManager.playBossSpawn();
    this.scene.uiManager?.showBanner(`💀 BOSS PRINCIPAL: ${template.name}! (RELÓGIO TRAVADO)`, '#ef4444');
    return boss;
  }

  spawnMilestoneBossNow(player, milestoneLevel) {
    if (!player) return null;
    const baseTemplate = MAIN_BOSS_TEMPLATES[this.milestoneBossIndex % MAIN_BOSS_TEMPLATES.length];
    this.milestoneBossIndex += 1;

    const angle = Math.random() * Math.PI * 2;
    const x = player.sprite.x + Math.cos(angle) * 360;
    const y = player.sprite.y + Math.sin(angle) * 360;
    const minuteT = this.scene.runSeconds / 60;

    const levelMult = milestoneLevel / 10;
    const milestoneTemplate = {
      ...baseTemplate,
      name: `Titã de Ascensão (${baseTemplate.name.split(',')[0]} - Marco Nv.${milestoneLevel})`,
      hp: Math.round(baseTemplate.hp * (1.6 + levelMult * 0.45)),
      damage: Math.round(baseTemplate.damage * (1.25 + levelMult * 0.15)),
      speed: Math.round(baseTemplate.speed * 1.15),
      xp: Math.round(baseTemplate.xp * 2.2),
      gold: 150 + milestoneLevel * 5,
      scale: (baseTemplate.scale || 2.1) * 1.18,
      weight: 18.0
    };

    const boss = new Boss(this.scene, x, y, milestoneTemplate, minuteT, player.kills, true, {
      isMilestoneBoss: true,
      milestoneLevel
    });
    this.enemies.push(boss);

    this.scene.isTimerLockedByBoss = true;
    this.scene.setBossAtmosphere(true, true);
    soundManager.playBossSpawn();
    this.scene.uiManager?.showBanner(`👑 TITÃ DO MARCO DECENAL: NÍVEL ${milestoneLevel}! (DESAFIO SUPREMO)`, '#f59e0b');
    return boss;
  }

  spawnMainBossForced() {
    return this.spawnMainBossNow();
  }

  getActiveBoss() {
    return (
      this.enemies.find((e) => !e.isDead && e.isBoss) ||
      this.enemies.find((e) => !e.isDead && e.isMiniBoss) ||
      null
    );
  }

  spawnTreasureChestAtRandom(player) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 580 + Math.random() * 260;
    return this.createTreasureChest(
      player.sprite.x + Math.cos(angle) * dist,
      player.sprite.y + Math.sin(angle) * dist
    );
  }

  spawnTreasureChestNearPlayer() {
    const player = this.scene.player;
    if (!player) return null;
    return this.createTreasureChest(player.sprite.x + 110, player.sprite.y + 20);
  }

  createTreasureChest(x, y) {
    const runeCircle = this.scene.add.circle(x, y, 68, 0xfbbf24, 0.14).setDepth(4);
    runeCircle.setStrokeStyle(2, 0xf59e0b, 0.85);
    runeCircle.setVisible(false);

    const sprite = this.scene.add.image(x, y, 'treasure_chest').setDepth(9);
    const chest = {
      id: `chest_${Date.now()}_${Math.random()}`,
      type: 'chest',
      x,
      y,
      hp: 80,
      maxHp: 80,
      sprite,
      runeCircle,
      active: true
    };
    this.chests.push(chest);
    return chest;
  }

  spawnPetCageAtRandom(player) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 540 + Math.random() * 240;
    return this.createPetCage(
      player.sprite.x + Math.cos(angle) * dist,
      player.sprite.y + Math.sin(angle) * dist
    );
  }

  spawnPetCageNearPlayer() {
    const player = this.scene.player;
    if (!player) return null;
    return this.createPetCage(player.sprite.x - 110, player.sprite.y + 20);
  }

  createPetCage(x, y) {
    const rescuablePool = PETS_DATA.filter((p) => !p.exclusiveTo);
    const petData = rescuablePool[Math.floor(Math.random() * rescuablePool.length)];

    const glow = this.scene.add.circle(x, y, 36, 0x10b981, 0.22).setDepth(5);
    const petPreview = this.scene.add.sprite(x, y, petData.spriteKey, 0).setDepth(8).setScale(0.85);
    const sprite = this.scene.add.image(x, y, 'pet_cage').setDepth(9);

    const cage = {
      id: `cage_${Date.now()}_${Math.random()}`,
      type: 'cage',
      x,
      y,
      hp: 65,
      maxHp: 65,
      petData,
      sprite,
      petPreview,
      glow,
      active: true
    };
    this.cages.push(cage);
    return cage;
  }

  spawnEnvironmentalHazard(player, forcedKind = null) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 260 + Math.random() * 240;
    const x = player.sprite.x + Math.cos(angle) * dist;
    const y = player.sprite.y + Math.sin(angle) * dist;

    this.hazardCounter = (this.hazardCounter || 0) + 1;
    const kind = forcedKind || (this.hazardCounter % 2 === 0 ? 'mana_geyser' : 'unstable_crystal');
    const isGeyser = kind === 'mana_geyser';
    const color = isGeyser ? 0x38bdf8 : 0xec4899;
    const strokeColor = isGeyser ? 0x7dd3fc : 0xf472b6;
    const texKey = isGeyser ? 'hazard_mana_geyser' : 'hazard_crystal';

    const ring = this.scene.add.circle(x, y, 95, color, 0.12).setDepth(3);
    ring.setStrokeStyle(2, strokeColor, 0.72);
    const innerRing = this.scene.add.circle(x, y, 95, color, 0.25).setDepth(3).setScale(0.15);
    const sprite = this.scene.add.image(x, y, texKey).setDepth(8);

    const hazard = {
      type: 'hazard',
      kind,
      name: isGeyser ? 'Gêiser de Mana' : 'Cristal Instável',
      color,
      element: isGeyser ? 'ice' : 'arcane',
      x,
      y,
      hp: 40,
      fuseMs: 4200,
      elapsedMs: 0,
      sprite,
      ring,
      innerRing,
      active: true
    };
    this.hazards.push(hazard);
    return hazard;
  }

  damageInteractablesNear(x, y, radius, damage) {
    let hitAny = false;

    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      if (!c.active) continue;
      if (Math.hypot(c.x - x, c.y - y) <= radius + 24) {
        c.hp -= damage;
        hitAny = true;
        if (c.hp <= 0) {
          this.breakTreasureChest(i);
        }
      }
    }

    for (let i = this.cages.length - 1; i >= 0; i--) {
      const cg = this.cages[i];
      if (!cg.active) continue;
      if (Math.hypot(cg.x - x, cg.y - y) <= radius + 24) {
        cg.hp -= damage;
        hitAny = true;
        if (cg.hp <= 0) {
          this.breakPetCage(i);
        }
      }
    }

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      if (!hz.active) continue;
      if (Math.hypot(hz.x - x, hz.y - y) <= radius + 22) {
        hz.hp -= damage;
        hitAny = true;
        if (hz.hp <= 0) {
          this.detonateHazard(i);
        }
      }
    }

    return hitAny;
  }

  breakTreasureChest(index) {
    const chest = this.chests[index];
    if (!chest || !chest.active) return;
    chest.active = false;
    chest.sprite.destroy();
    chest.runeCircle.destroy();
    this.chests.splice(index, 1);

    soundManager.playChestBreak();
    const player = this.scene.player;
    if (!player) return;

    const goldBonus = Math.round((35 + Math.floor(Math.random() * 25)) * player.xpGoldMult);
    player.goldEarned += goldBonus;
    saveManager.addGold(goldBonus);

    const drop = CHEST_DROP_ITEMS[Math.floor(Math.random() * CHEST_DROP_ITEMS.length)];
    this.applyChestDropItem(drop, chest.x, chest.y);
  }

  applyChestDropItem(drop, x, y) {
    const player = this.scene.player;
    if (!player) return;

    this.scene.combatSystem?.spawnFloatingText(x, y - 24, `${drop.icon} ${drop.name}!`, drop.color);
    this.scene.uiManager?.showBanner(`${drop.icon} BAÚ ABERTO: ${drop.name}!`, drop.color);

    switch (drop.id) {
      case 'global_magnet':
        this.scene.gemManager?.attractAllGems();
        break;

      case 'phoenix_heart':
        player.heal(Math.round(player.maxHp * 0.50));
        break;

      case 'awakening_tome': {
        const roll = Math.random();
        const levels = roll < 0.15 ? 10 : roll < 0.45 ? 5 : 2;
        player.gainInstantLevels(levels);
        break;
      }

      case 'reaper_scythe':
        this.killAllEnemiesOnScreen(true);
        break;

      case 'chronos_hourglass':
        this.scene.enemiesFrozenUntil = performance.now() + 6000;
        break;

      case 'fury_chalice':
        player.furyBuffUntil = performance.now() + 10000;
        break;
    }
  }

  breakPetCage(index) {
    const cage = this.cages[index];
    if (!cage || !cage.active) return;
    cage.active = false;
    cage.sprite.destroy();
    cage.petPreview.destroy();
    cage.glow.destroy();
    this.cages.splice(index, 1);

    soundManager.playChestBreak();
    const player = this.scene.player;
    if (!player) return;

    const pet = new Pet(this.scene, player, cage.petData, this.pets.length);
    this.pets.push(pet);
    saveManager.unlockAchievement('pack_rescuer');
    this.scene.uiManager?.showBanner(`🐾 PET RESGATADO: ${cage.petData.name}!`, '#10b981');
  }

  detonateHazard(index) {
    const hz = this.hazards[index];
    if (!hz || !hz.active) return;
    hz.active = false;
    hz.sprite.destroy();
    hz.ring.destroy();
    hz.innerRing?.destroy();
    this.hazards.splice(index, 1);

    // Explodes damaging enemies AND player if inside 95px blast circle
    this.scene.combatSystem?.triggerAoEExplosion(hz.x, hz.y, 95, 85, hz.element || 'arcane', {
      color: hz.color || 0xec4899,
      knockback: 180
    });
    const player = this.scene.player;
    if (player && Math.hypot(player.sprite.x - hz.x, player.sprite.y - hz.y) <= 95) {
      player.takeDamage(22, performance.now());
    }
  }

  onEnemyKilled(enemy) {
    if (enemy.isDead) return;
    const ex = enemy.sprite.x;
    const ey = enemy.sprite.y;
    const xpVal = enemy.xpValue;
    const wasMainBoss = enemy.isBoss;
    const wasMiniBoss = enemy.isMiniBoss;
    const goldReward = enemy.template?.gold || 0;

    enemy.destroy();
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) this.enemies.splice(idx, 1);

    const player = this.scene.player;
    if (player) {
      player.kills += 1;
      if (goldReward > 0) {
        player.goldEarned += goldReward;
        saveManager.addGold(goldReward);
      } else if (player.kills % 12 === 0) {
        player.goldEarned += 5;
        saveManager.addGold(5);
      }
    }

    this.scene.gemManager?.spawnGem(ex, ey, xpVal, wasMainBoss || wasMiniBoss);
    this.scene.spawnGroundDecal?.(ex, ey, enemy.baseTint || 0x450a0a);

    if (wasMainBoss || wasMiniBoss) {
      this.createTreasureChest(ex, ey);
      if (wasMainBoss && enemy.suddenDeathRemainingSec > 0) {
        saveManager.unlockAchievement('boss_slayer');
      }
      if (enemy.isMilestoneBoss) {
        saveManager.unlockAchievement('boss_slayer');
        this.scene.uiManager?.showBanner(`🏆 TITÃ DE ASCENSÃO DERROTADO! +${goldReward} OURO!`, '#fbbf24');
      }
      // Check if any Boss/Mini-Boss remains alive
      const stillHasMainBoss = this.enemies.some((e) => !e.isDead && e.isBoss);
      const stillHasAnyBoss = this.enemies.some((e) => !e.isDead && (e.isBoss || e.isMiniBoss));
      if (!stillHasMainBoss) {
        this.scene.isTimerLockedByBoss = false;
      }
      if (!stillHasAnyBoss) {
        this.scene.setBossAtmosphere(false, false);
      }
    }
  }

  /**
   * Debug Button #11 & Reaper Scythe Chest Drop
   */
  killAllEnemiesOnScreen(isReaperDrop = false) {
    const copy = [...this.enemies];
    for (const e of copy) {
      if (!e || e.isDead) continue;
      if (isReaperDrop && (e.isBoss || e.isMiniBoss)) {
        if (Math.random() < 0.05) {
          this.onEnemyKilled(e);
        } else {
          e.hp = Math.max(1, Math.round(e.hp * 0.75));
        }
      } else {
        this.onEnemyKilled(e);
      }
    }
  }
}

export default SpawnSystem;
