import { ELEMENTS } from '../config/elementsData.js';
import AnimationSystem from './AnimationSystem.js';
import saveManager from './SaveManager.js';
import soundManager from './SoundManager.js';
import ElementalReactionMatrix from './combat/ElementalReactionMatrix.js';

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.groundZones = [];
    this.orbitalAngles = new Map();
    this.orbitalSprites = new Map();
    this.reactionDamageTotal = 0;
  }

  getProjectileVisualConfig(skill) {
    const id = skill.id || '';
    const activeId = skill.activeId || '';
    const activeA = skill.activeAId || '';
    const activeB = skill.activeBId || '';
    if (
      id.includes('rock') ||
      activeId === 'rock_barrage' ||
      activeA === 'rock_barrage' ||
      id === 'fusion_volcanic_tectonic_titan'
    ) {
      return { tex: 'proj_rock', spinSpeed: 7, align: false };
    }
    if (id.includes('igneous') || activeId === 'igneous_bombardment' || activeA === 'igneous_bombardment') {
      return { tex: 'proj_fireball', spinSpeed: 0, align: true };
    }
    if (id.includes('ice_lance') || activeId === 'ice_lance' || activeA === 'ice_lance') {
      return { tex: 'proj_icelance', spinSpeed: 0, align: true };
    }
    if (
      id.includes('thorn') ||
      activeId === 'thorn_swarm' ||
      activeA === 'thorn_swarm' ||
      id === 'fusion_primordial_gaia_wrath'
    ) {
      return { tex: 'proj_thorn', spinSpeed: 0, align: true };
    }
    if (
      id.includes('chakram') ||
      activeId === 'gale_chakram' ||
      activeA === 'gale_chakram' ||
      id === 'fusion_nine_winds_blizzard'
    ) {
      return { tex: 'proj_chakram', spinSpeed: 12, align: false };
    }
    if (id === 'fusion_paradox_singularity' || (activeA === 'abyssal_orb' && activeB === 'temporal_needle')) {
      return { tex: 'proj_void_orb', spinSpeed: -6, align: false, slowPct: 0.35 };
    }
    if (id.includes('abyssal') || activeId === 'abyssal_orb' || activeA === 'abyssal_orb') {
      return { tex: 'proj_void_orb', spinSpeed: -4, align: false };
    }
    if (id.includes('temporal') || activeId === 'temporal_needle' || activeB === 'temporal_needle') {
      return { tex: 'proj_temporal_needle', spinSpeed: 0, align: true, slowPct: 0.35 };
    }
    if (id.includes('acid') || id.includes('plague') || activeId === 'acid_flask' || activeB === 'acid_flask') {
      return { tex: 'proj_acid_flask', spinSpeed: 9, align: false };
    }
    if (id.includes('meteor') || activeId === 'meteor_rain' || activeB === 'meteor_rain') {
      return { tex: 'proj_meteor', spinSpeed: 0, align: true };
    }
    if (id.includes('totem') || activeId === 'spirit_totem' || activeB === 'spirit_totem') {
      return { tex: 'proj_totem', spinSpeed: 0, align: false };
    }
    return { tex: 'projectile_orb', spinSpeed: 5, align: false, useElementTint: true };
  }

  getVfxAlpha(baseAlpha = 1.0) {
    return baseAlpha * saveManager.getVfxOpacity();
  }

  findNearestEnemy(x, y, maxDist = 700) {
    const enemies = this.scene.spawnSystem?.enemies || [];
    let best = null;
    let bestSq = maxDist * maxDist;
    for (const e of enemies) {
      if (e.isDead || !e.sprite?.active) continue;
      const dx = e.sprite.x - x;
      const dy = e.sprite.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestSq) {
        bestSq = d2;
        best = e;
      }
    }
    return best;
  }

  findHighestHpEnemy(x, y, maxDist = 750) {
    const enemies = this.scene.spawnSystem?.enemies || [];
    let best = null;
    let bestHp = -1;
    const maxSq = maxDist * maxDist;
    for (const e of enemies) {
      if (e.isDead || !e.sprite?.active) continue;
      const dx = e.sprite.x - x;
      const dy = e.sprite.y - y;
      if (dx * dx + dy * dy <= maxSq && e.hp > bestHp) {
        bestHp = e.hp;
        best = e;
      }
    }
    return best || this.findNearestEnemy(x, y, maxDist);
  }

  findDenseClusterEnemy(x, y, maxDist = 650) {
    const enemies = this.scene.spawnSystem?.enemies || [];
    const candidates = [];
    const maxSq = maxDist * maxDist;
    for (const e of enemies) {
      if (e.isDead || !e.sprite?.active) continue;
      const dx = e.sprite.x - x;
      const dy = e.sprite.y - y;
      if (dx * dx + dy * dy <= maxSq) candidates.push(e);
    }
    if (candidates.length === 0) return null;

    let best = candidates[0];
    let bestNeighbors = -1;
    const sampleLimit = Math.min(candidates.length, 24);
    for (let i = 0; i < sampleLimit; i++) {
      const c = candidates[i];
      let count = 0;
      for (let j = 0; j < candidates.length; j++) {
        const o = candidates[j];
        const dx = o.sprite.x - c.sprite.x;
        const dy = o.sprite.y - c.sprite.y;
        if (dx * dx + dy * dy <= 110 * 110) count++;
      }
      if (count > bestNeighbors) {
        bestNeighbors = count;
        best = c;
      }
    }
    return best;
  }

  update(timeMs, deltaMs, player) {
    if (!player || player.isDead) return;

    const isFury = timeMs < player.furyBuffUntil;
    const castSpeedMult =
      (player.characterData.stats.attackSpeedMult || 1.0) *
      (1 / Math.max(0.28, 1 - player.cooldownReduction)) *
      (isFury ? 2.0 : 1.0);

    // 1. Update Active Skills Cooldowns & Auto-Cast
    for (const slot of player.activeSkills.values()) {
      slot.cooldownTimer -= deltaMs * castSpeedMult;

      if (slot.data.targeting === 'orbital') {
        this.updateOrbitalWeapon(timeMs, deltaMs, player, slot);
      }

      if (slot.cooldownTimer <= 0) {
        slot.cooldownTimer = slot.data.cooldown;
        this.castSkillFromOrigin(player.sprite.x, player.sprite.y, player, slot, timeMs, true);

        // Spectral Clones fire exact copies of all active skills!
        for (const clone of player.clones) {
          if (clone.sprite?.active) {
            AnimationSystem.playCastAnimation(clone.sprite);
            this.castSkillFromOrigin(clone.sprite.x, clone.sprite.y, player, slot, timeMs, false);
          }
        }
      }
    }

    // Clean up orbital sprites for skills that were fused/consumed
    for (const [orbKey, sprites] of this.orbitalSprites.entries()) {
      if (!player.activeSkills.has(orbKey)) {
        for (const s of sprites) s.destroy();
        this.orbitalSprites.delete(orbKey);
      }
    }

    // 2. Update Player Projectiles
    const dtSec = deltaMs / 1000;
    for (let i = this.playerProjectiles.length - 1; i >= 0; i--) {
      const p = this.playerProjectiles[i];
      p.elapsed += deltaMs;

      if (p.elapsed >= p.maxDuration || !p.sprite?.active) {
        if (p.explodeOnExpire) {
          this.triggerAoEExplosion(p.x, p.y, p.aoeRadius, p.damage, p.element, {
            slotRef: p.slotRef,
            petRef: p.petRef,
            secondaryElement: p.secondaryElement
          });
        }
        p.sprite?.destroy();
        this.playerProjectiles.splice(i, 1);
        continue;
      }

      if (p.isBoomerang && p.elapsed > p.maxDuration * 0.48) {
        const dx = player.sprite.x - p.x;
        const dy = player.sprite.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        p.vx = (dx / dist) * p.speed * 1.15;
        p.vy = (dy / dist) * p.speed * 1.15;
      }

      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.sprite.setPosition(p.x, p.y);
      if (p.alignToVelocity) {
        p.sprite.setRotation(Math.atan2(p.vy, p.vx));
      } else {
        p.sprite.rotation += dtSec * (p.spinSpeed ?? 5);
      }

      // Vortex suction during flight
      if (p.isVortex) {
        this.pullEnemiesToward(p.x, p.y, p.aoeRadius * 1.25, 110 * dtSec);
      }

      // Check collision with enemies & chests/cages/crystals
      this.checkProjectileHits(p, timeMs);
      if (p.pierceRemaining <= 0) {
        p.sprite?.destroy();
        this.playerProjectiles.splice(i, 1);
      }
    }

    // 3. Update Ground Zones (Acid pools, Magma fissures, Totems)
    for (let i = this.groundZones.length - 1; i >= 0; i--) {
      const z = this.groundZones[i];
      z.elapsed += deltaMs;
      z.tickTimer += deltaMs;
      if (z.elapsed >= z.duration) {
        z.graphic?.destroy();
        z.totemSprite?.destroy();
        this.groundZones.splice(i, 1);
        continue;
      }
      if (z.totemSprite?.active) {
        z.totemSprite.setScale(0.95 + 0.08 * Math.sin(z.elapsed * 0.008));
      }
      if (z.tickTimer >= z.tickInterval) {
        z.tickTimer -= z.tickInterval;
        this.triggerAoEExplosion(z.x, z.y, z.radius, z.damagePerTick, z.element, {
          slotRef: z.slotRef,
          slowPct: z.slowPct || 0,
          silent: true
        });
      }
    }

    // 4. Update Enemy Projectiles
    const enemiesFrozen = timeMs < (this.scene.enemiesFrozenUntil || 0);
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      if (!enemiesFrozen) {
        ep.elapsed += deltaMs;
        ep.x += ep.vx * dtSec;
        ep.y += ep.vy * dtSec;
        ep.sprite.setPosition(ep.x, ep.y);
      }
      if (ep.elapsed >= 4000) {
        ep.sprite.destroy();
        this.enemyProjectiles.splice(i, 1);
        continue;
      }
      const distPlayer = Math.hypot(player.sprite.x - ep.x, player.sprite.y - ep.y);
      if (distPlayer < 20) {
        player.takeDamage(ep.damage, timeMs);
        ep.sprite.destroy();
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  castSkillFromOrigin(ox, oy, player, slot, timeMs, isMainPlayer = true) {
    const skill = slot.data;
    const lvl = slot.level;
    const isFury = timeMs < player.furyBuffUntil;
    const isSeismic = timeMs < player.seismicBuffUntil;

    const lvlDmgScale = 1 + (lvl - 1) * 0.24;
    const baseDmg = Math.round(
      skill.baseDamage *
        lvlDmgScale *
        player.damageMult *
        (isSeismic ? 1.5 : 1.0) *
        (isMainPlayer ? 1.0 : 0.65)
    );

    const extraLvlProj = Math.floor(lvl / 2);
    const totalProjectiles = Math.max(1, skill.projectiles + extraLvlProj + player.extraProjectiles);
    const areaScale = skill.area * (1 + (lvl - 1) * 0.12) * player.areaMult * (isFury ? 1.6 : 1.0);
    const projSpeed = (skill.speed || 420) * player.projectileSpeedMult;

    let target = null;
    if (skill.targeting === 'highest_hp') {
      target = this.findHighestHpEnemy(ox, oy, 750);
    } else if (skill.targeting === 'dense_cluster' || skill.targeting === 'lob_pool' || skill.targeting === 'sky_strike') {
      target = this.findDenseClusterEnemy(ox, oy, 680);
    } else {
      target = this.findNearestEnemy(ox, oy, 700);
    }

    const tx = target ? target.sprite.x : ox + player.lastMoveDir.x * 220;
    const ty = target ? target.sprite.y : oy + player.lastMoveDir.y * 220;
    const baseAngle = Math.atan2(ty - oy, tx - ox);

    if (isMainPlayer) {
      AnimationSystem.playCastAnimation(player.sprite);

      // Petrus 4-Arm Articulation & Every 4th Attack Seismic Megalith!
      if (player.fourArms.length > 0) {
        const armIdx = player.attackCounter % player.fourArms.length;
        AnimationSystem.triggerArmRecoil(this.scene, player.fourArms[armIdx], tx, ty);
        player.attackCounter += 1;

        if (player.attackCounter % 4 === 0) {
          for (const arm of player.fourArms) {
            AnimationSystem.triggerArmRecoil(this.scene, arm, tx, ty);
          }
          this.triggerPetrusMegalithCone(ox, oy, baseAngle, Math.round(baseDmg * 1.45), areaScale * 1.35, slot);
        }
      }
    }

    // Handle specialized targeting modes
    if (skill.targeting === 'orbital') {
      // Dual Fusion: Ira do Firmamento Solar (solar_hammer + meteor_rain) also rains meteors on cooldown!
      if (skill.id === 'fusion_solar_firmament_wrath' || skill.activeBId === 'meteor_rain') {
        for (let i = 0; i < 3; i++) {
          const mx = ox + (Math.random() - 0.5) * 440;
          const my = oy + (Math.random() - 0.5) * 340;
          this.castMeteorStrike(mx, my, 88 * areaScale, Math.round(baseDmg * 0.85), skill.element, {
            slotRef: slot,
            secondaryElement: skill.secondaryElement,
            knockback: skill.knockback * player.knockbackMult
          });
        }
      }
      return;
    }

    if (skill.targeting === 'chain') {
      this.castChainLightning(ox, oy, totalProjectiles, baseDmg, skill.pierce + lvl, skill.element, slot, skill.secondaryElement);
      return;
    }

    if (skill.targeting === 'lob_pool' || skill.targeting === 'totem_zone') {
      const isTotem = skill.targeting === 'totem_zone';
      for (let i = 0; i < Math.min(totalProjectiles, 4); i++) {
        const spreadX = tx + (Math.random() - 0.5) * 140 * i;
        const spreadY = ty + (Math.random() - 0.5) * 140 * i;
        const zoneCfg = {
          x: spreadX,
          y: spreadY,
          radius: 72 * areaScale,
          duration: 3200 * player.durationMult,
          tickInterval: 450,
          damagePerTick: Math.max(4, Math.round(baseDmg * 0.55)),
          element: skill.element,
          color: ELEMENTS[skill.element]?.color || 0x84cc16,
          slotRef: slot,
          withTotemSprite: isTotem,
          slowPct: isTotem ? 0.25 : 0
        };

        if (!isTotem) {
          // Animate lobbed Acid Flask bottle in flight before shattering into pool
          const flask = this.scene.add.image(ox, oy, 'proj_acid_flask').setDepth(15);
          flask.setAlpha(this.getVfxAlpha(0.95));
          this.scene.tweens.add({
            targets: flask,
            x: spreadX,
            y: spreadY,
            rotation: Math.PI * 2,
            scale: { from: 0.85, to: 1.15 },
            duration: 190,
            onComplete: () => {
              flask.destroy();
              if (!this.scene || this.scene.isGameOver) return;
              this.spawnGroundZone(zoneCfg);
            }
          });
        } else {
          this.spawnGroundZone(zoneCfg);
        }
      }
      return;
    }

    if (skill.targeting === 'sky_strike') {
      for (let i = 0; i < Math.min(totalProjectiles, 6); i++) {
        const mx = ox + (Math.random() - 0.5) * 520;
        const my = oy + (Math.random() - 0.5) * 380;
        this.castMeteorStrike(mx, my, 92 * areaScale, baseDmg, skill.element, {
          slotRef: slot,
          secondaryElement: skill.secondaryElement,
          knockback: skill.knockback * player.knockbackMult
        });
      }
      return;
    }

    // Dual Fusion: Cólera de Gaia Primordial (thorn_swarm + spirit_totem) spawns an ancestral totem + 360° thorn ring!
    const isGaiaFusion = skill.id === 'fusion_primordial_gaia_wrath';
    if (isGaiaFusion && isMainPlayer) {
      this.spawnGroundZone({
        x: ox,
        y: oy,
        radius: 82 * areaScale,
        duration: 2800 * player.durationMult,
        tickInterval: 450,
        damagePerTick: Math.max(6, Math.round(baseDmg * 0.5)),
        element: skill.secondaryElement || 'earth',
        color: ELEMENTS.earth.color,
        slotRef: slot,
        withTotemSprite: true,
        slowPct: 0.30
      });
    }

    // Standard Projectile / Cone / Boomerang / Vortex / Line Pierce
    const spreadStep = isGaiaFusion
      ? (Math.PI * 2) / Math.max(1, totalProjectiles)
      : skill.targeting === 'frontal_cone'
        ? 0.16
        : 0.12;
    const visCfg = this.getProjectileVisualConfig(skill);
    for (let i = 0; i < totalProjectiles; i++) {
      const offsetIdx = i - (totalProjectiles - 1) / 2;
      const angle = isGaiaFusion ? baseAngle + i * spreadStep : baseAngle + offsetIdx * spreadStep;
      const elemColor = ELEMENTS[skill.element]?.color || 0xffffff;

      const projSprite = this.scene.add.image(ox, oy, visCfg.tex);
      projSprite.setDepth(14);
      if (visCfg.useElementTint) {
        projSprite.setTint(elemColor);
      }
      projSprite.setAlpha(this.getVfxAlpha(0.95));
      projSprite.setScale(Math.min(2.6, 0.9 * areaScale));
      if (visCfg.align) {
        projSprite.setRotation(angle);
      }

      this.playerProjectiles.push({
        sprite: projSprite,
        x: ox,
        y: oy,
        vx: Math.cos(angle) * projSpeed,
        vy: Math.sin(angle) * projSpeed,
        speed: projSpeed,
        spinSpeed: visCfg.spinSpeed,
        alignToVelocity: visCfg.align,
        slowPct: visCfg.slowPct || 0,
        damage: baseDmg,
        element: skill.element,
        secondaryElement: skill.secondaryElement || null,
        knockback: (skill.knockback || 70) * player.knockbackMult,
        pierceRemaining: (skill.pierce || 1) + Math.floor(lvl / 2),
        aoeRadius: skill.targeting === 'dense_cluster' || skill.targeting === 'vortex' ? 85 * areaScale : 26 * areaScale,
        explodeOnHit: skill.targeting === 'dense_cluster' || skill.targeting === 'vortex',
        explodeOnExpire: skill.targeting === 'vortex',
        isBoomerang: skill.targeting === 'boomerang',
        isVortex: skill.targeting === 'vortex',
        maxDuration: (skill.targeting === 'boomerang' ? 1750 : 1400) * player.durationMult,
        elapsed: 0,
        hitSet: new Set(),
        slotRef: slot
      });
    }
  }

  castMeteorStrike(mx, my, radius, damage, element, options = {}) {
    const startX = mx + 75;
    const startY = my - 150;
    const meteor = this.scene.add.image(startX, startY, 'proj_meteor').setDepth(18);
    meteor.setAlpha(this.getVfxAlpha(0.95));
    meteor.setRotation(Math.atan2(my - startY, mx - startX));

    // Subtle target shadow ring before impact
    const shadow = this.scene.add.circle(mx, my, radius * 0.35, 0xf97316, this.getVfxAlpha(0.25)).setDepth(4);
    this.scene.tweens.add({
      targets: shadow,
      scale: 2.2,
      duration: 165,
      onComplete: () => shadow.destroy()
    });

    this.scene.tweens.add({
      targets: meteor,
      x: mx,
      y: my,
      duration: 165,
      onComplete: () => {
        meteor.destroy();
        if (!this.scene || this.scene.isGameOver) return;
        this.triggerAoEExplosion(mx, my, radius, damage, element, options);
      }
    });
  }

  updateOrbitalWeapon(timeMs, deltaMs, player, slot) {
    const skill = slot.data;
    const isFury = timeMs < player.furyBuffUntil;
    const count = Math.min(8, skill.projectiles + Math.floor(slot.level / 2) + player.extraProjectiles);
    const orbitRadius = 88 * skill.area * player.areaMult;
    const hammerScale = Math.min(2.3, 0.95 * skill.area * player.areaMult * (isFury ? 1.4 : 1.0));
    const prevAngle = this.orbitalAngles.get(slot.id) || 0;
    const nextAngle = prevAngle + (deltaMs / 1000) * 3.6;
    this.orbitalAngles.set(slot.id, nextAngle);

    // Sync persistent orbital warhammer sprites for smooth visual feedback
    let sprites = this.orbitalSprites.get(slot.id);
    if (!sprites) {
      sprites = [];
      this.orbitalSprites.set(slot.id, sprites);
    }
    while (sprites.length < count) {
      const s = this.scene.add.image(player.sprite.x, player.sprite.y, 'proj_solar_hammer');
      s.setDepth(16);
      sprites.push(s);
    }
    while (sprites.length > count) {
      const removed = sprites.pop();
      removed?.destroy();
    }

    for (let i = 0; i < count; i++) {
      const ang = nextAngle + (i * Math.PI * 2) / count;
      const hx = player.sprite.x + Math.cos(ang) * orbitRadius;
      const hy = player.sprite.y + Math.sin(ang) * orbitRadius;
      const s = sprites[i];
      if (s && s.active) {
        s.setPosition(hx, hy);
        s.setRotation(ang + Math.PI / 2);
        s.setScale(hammerScale);
        s.setAlpha(this.getVfxAlpha(0.95));
      }
    }

    // Hit check every ~160ms
    slot.orbitalTick = (slot.orbitalTick || 0) + deltaMs;
    if (slot.orbitalTick < 160) return;
    slot.orbitalTick = 0;

    const dmg = Math.round(skill.baseDamage * (1 + (slot.level - 1) * 0.2) * player.damageMult * 0.55);
    const hitRadius = Math.round(34 * Math.min(1.8, player.areaMult));

    for (let i = 0; i < count; i++) {
      const ang = nextAngle + (i * Math.PI * 2) / count;
      const hx = player.sprite.x + Math.cos(ang) * orbitRadius;
      const hy = player.sprite.y + Math.sin(ang) * orbitRadius;

      this.damageEnemiesInRadius(hx, hy, hitRadius, dmg, {
        element: skill.element,
        secondaryElement: skill.secondaryElement,
        knockback: skill.knockback * player.knockbackMult,
        slotRef: slot
      });
      this.scene.spawnSystem?.damageInteractablesNear(hx, hy, hitRadius + 2, dmg);
    }
  }

  triggerPetrusMegalithCone(ox, oy, angle, damage, areaScale, slotRef) {
    const coneX = ox + Math.cos(angle) * 95;
    const coneY = oy + Math.sin(angle) * 95;
    const radius = 115 * areaScale;

    const wave = this.scene.add.circle(coneX, coneY, radius, 0xd97706, this.getVfxAlpha(0.45)).setDepth(12);
    wave.setStrokeStyle(3, 0xfbbf24, this.getVfxAlpha(0.9));
    this.scene.tweens.add({
      targets: wave,
      scale: 1.25,
      alpha: 0,
      duration: 280,
      onComplete: () => wave.destroy()
    });

    this.damageEnemiesInRadius(coneX, coneY, radius, damage, {
      element: 'earth',
      knockback: 240,
      stunMs: 800,
      slotRef
    });
  }

  castChainLightning(ox, oy, chainsCount, damage, maxJumps, element, slotRef, secondaryElement = null, petRef = null) {
    const enemies = this.scene.spawnSystem?.enemies || [];
    const visited = new Set();
    const totalChains = Math.max(1, Math.min(chainsCount || 1, 6));
    const lineColor = element ? (ELEMENTS[element]?.color || 0xfacc15) : 0xfacc15;

    for (let c = 0; c < totalChains; c++) {
      let currX = ox;
      let currY = oy;

      for (let j = 0; j < maxJumps; j++) {
        let best = null;
        let bestSq = 280 * 280;
        for (const e of enemies) {
          if (e.isDead || !e.sprite?.active || visited.has(e)) continue;
          const dx = e.sprite.x - currX;
          const dy = e.sprite.y - currY;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestSq) {
            bestSq = d2;
            best = e;
          }
        }
        if (!best) break;
        visited.add(best);

        // Multi-segment jagged forked lightning bolt
        const boltGfx = this.scene.add.graphics().setDepth(15);
        const tx = best.sprite.x;
        const ty = best.sprite.y;
        const dx = tx - currX;
        const dy = ty - currY;
        const len = Math.hypot(dx, dy) || 1;
        const px = -dy / len;
        const py = dx / len;
        const pts = [{ x: currX, y: currY }];
        for (let s = 1; s <= 3; s++) {
          const frac = s / 4;
          const jitter = (s % 2 === 0 ? 1 : -1) * (6 + Math.random() * 6);
          pts.push({
            x: currX + dx * frac + px * jitter,
            y: currY + dy * frac + py * jitter
          });
        }
        pts.push({ x: tx, y: ty });

        boltGfx.lineStyle(3.4, lineColor, this.getVfxAlpha(0.9));
        boltGfx.beginPath();
        boltGfx.moveTo(pts[0].x, pts[0].y);
        for (let s = 1; s < pts.length; s++) boltGfx.lineTo(pts[s].x, pts[s].y);
        boltGfx.strokePath();

        boltGfx.lineStyle(1.4, 0xffffff, this.getVfxAlpha(0.95));
        boltGfx.beginPath();
        boltGfx.moveTo(pts[0].x, pts[0].y);
        for (let s = 1; s < pts.length; s++) boltGfx.lineTo(pts[s].x, pts[s].y);
        boltGfx.strokePath();

        this.scene.tweens.add({
          targets: boltGfx,
          alpha: 0,
          duration: 165,
          onComplete: () => boltGfx.destroy()
        });

        this.dealDamageToEnemy(best, damage, {
          element,
          secondaryElement,
          knockback: 45,
          fromX: currX,
          fromY: currY,
          slotRef,
          petRef
        });

        currX = tx;
        currY = ty;
      }
    }

    // Also damage nearby chests/cages
    this.scene.spawnSystem?.damageInteractablesNear(ox, oy, 220, damage);
  }

  checkProjectileHits(p, timeMs) {
    // Check Chests, Pet Cages, and Unstable Crystals / Mana Geysers
    if (this.scene.spawnSystem?.damageInteractablesNear(p.x, p.y, 28, p.damage)) {
      p.pierceRemaining -= 1;
      if (p.pierceRemaining <= 0) return;
    }

    const enemies = this.scene.spawnSystem?.enemies || [];
    const hitRadius = p.explodeOnHit ? 28 : 24;
    const hitRadiusSq = hitRadius * hitRadius;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.isDead || !e.sprite?.active || p.hitSet.has(e)) continue;

      const dx = e.sprite.x - p.x;
      const dy = e.sprite.y - p.y;
      if (dx * dx + dy * dy <= hitRadiusSq) {
        p.hitSet.add(e);
        p.pierceRemaining -= 1;

        if (p.slowPct) {
          e.slowPct = Math.max(e.slowPct, p.slowPct);
          e.slowUntil = Math.max(e.slowUntil, timeMs + 2200);
        }

        if (p.explodeOnHit) {
          this.triggerAoEExplosion(p.x, p.y, p.aoeRadius, p.damage, p.element, {
            slotRef: p.slotRef,
            petRef: p.petRef,
            secondaryElement: p.secondaryElement,
            knockback: p.knockback
          });
          // Crimson Drake (Dragonete Rubro): flames propagate between nearby enemies
          if (p.petRef?.petData?.id === 'crimson_drake') {
            this.castChainLightning(p.x, p.y, 1, Math.max(6, Math.round(p.damage * 0.55)), 4, 'fire', null, null, p.petRef);
          }
        } else {
          this.dealDamageToEnemy(e, p.damage, {
            element: p.element,
            secondaryElement: p.secondaryElement,
            knockback: p.knockback,
            fromX: p.x,
            fromY: p.y,
            slotRef: p.slotRef,
            petRef: p.petRef,
            timeMs
          });
        }

        if (p.isBoomerang && !e.isDead && e.sprite?.active && e.weight < 2.5) {
          e.applyKnockback(this.scene.player.sprite.x, this.scene.player.sprite.y, -95);
        }

        if (p.pierceRemaining <= 0) break;
      }
    }
  }

  dealDamageToEnemy(enemy, rawDamage, options = {}) {
    if (!enemy || enemy.isDead || !enemy.sprite?.active) return 0;

    const player = this.scene.player;
    const timeMs = options.timeMs || performance.now();

    // Boss Reflector Shield check
    if (enemy.reflectShieldUntil && timeMs < enemy.reflectShieldUntil) {
      rawDamage = Math.round(rawDamage * 0.45);
    }

    // Skeleton Warrior Bone Phalanx Shield check (25% direct hit mitigation)
    if (enemy.boneShieldActive && !options.isDot && !options.isReaction) {
      rawDamage = Math.round(rawDamage * 0.75);
    }

    // Elemental resistance/vulnerability multiplier
    const elemMult = enemy.getElementMultiplier(options.element);
    const armorMult = 1 + (enemy.armorReduction || 0) + (enemy.vulnerabilityBonus || 0);

    // Critical Hit calculation
    let isCrit = Boolean(options.guaranteedCrit);
    if (!isCrit && !options.isDot && player) {
      isCrit = Math.random() < player.critChance;
    }

    let critMult = 1.0;
    if (isCrit && player) {
      critMult = player.critDamageMult;
      // Crya Innate Passive: Zero Absoluto (+40% Crit Damage on chilled enemies)
      if (player.characterData.id === 'crya' && enemy.activeElement === 'ice') {
        critMult += 0.40;
      }
    }

    const finalDamage = Math.max(1, Math.round(rawDamage * elemMult * armorMult * critMult));
    enemy.hp -= finalDamage;

    // Record DPS stats
    if (options.slotRef) {
      options.slotRef.totalDamage = (options.slotRef.totalDamage || 0) + finalDamage;
    } else if (options.petRef) {
      options.petRef.totalDamage = (options.petRef.totalDamage || 0) + finalDamage;
    } else if (options.isReaction) {
      this.reactionDamageTotal += finalDamage;
    }

    if (!options.isDot) {
      AnimationSystem.triggerHitFlash(this.scene, enemy);
      soundManager.playHit(isCrit);
      if (enemy.sprite?.active) {
        this.spawnDamageNumber(enemy.sprite.x, enemy.sprite.y, finalDamage, isCrit);
      }
    }

    if (options.knockback && options.fromX !== undefined) {
      enemy.applyKnockback(options.fromX, options.fromY, options.knockback);
    }

    if (options.stunMs) {
      enemy.applyStun(options.stunMs, timeMs);
    }

    // Elemental Application & Cross-Reaction Check!
    const incomingElem = options.element;
    if (incomingElem && !options.isReaction) {
      if (enemy.activeElement && (enemy.activeElement !== incomingElem || incomingElem === 'arcane')) {
        this.triggerElementalReaction(enemy, enemy.activeElement, incomingElem, finalDamage, timeMs);
      } else {
        enemy.applyElementStatus(incomingElem, timeMs);
      }

      // Dual Fusion weapons carry a secondaryElement that immediately reacts (including Arcane+Arcane Singularity)!
      if (
        options.secondaryElement &&
        (options.secondaryElement !== incomingElem || options.secondaryElement === 'arcane') &&
        !enemy.isDead
      ) {
        this.triggerElementalReaction(enemy, incomingElem, options.secondaryElement, finalDamage, timeMs);
      }
    }

    if (enemy.hp <= 0 && !enemy.isDead) {
      this.handleEnemyDeath(enemy, timeMs);
    }

    return finalDamage;
  }

  triggerElementalReaction(enemy, firstElem, secondElem, baseHitDamage, timeMs) {
    return ElementalReactionMatrix.trigger({
      combatSystem: this,
      enemy,
      firstElem,
      secondElem,
      baseHitDamage,
      timeMs
    });
  }

  handleEnemyDeath(enemy, _timeMs) {
    if (enemy.isDead) return;
    const ex = enemy.sprite.x;
    const ey = enemy.sprite.y;
    const wasBurning = enemy.activeElement === 'fire';
    const maxHp = enemy.maxHp;

    this.scene.spawnSystem?.onEnemyKilled(enemy);

    // Ignis Innate Passive: Coração Vulcânico (burning enemies explode for 20% max HP)
    if (wasBurning && this.scene.player?.characterData.id === 'ignis') {
      const burnBlastDmg = Math.max(8, Math.round(maxHp * 0.20));
      this.triggerAoEExplosion(ex, ey, 95, burnBlastDmg, 'fire', {
        color: 0xf97316,
        silent: true
      });
    }
  }

  triggerAoEExplosion(x, y, radius, damage, element, options = {}) {
    const color = options.color || ELEMENTS[element]?.color || 0xf97316;
    const circle = this.scene.add.circle(x, y, radius, color, this.getVfxAlpha(0.38)).setDepth(11);
    circle.setStrokeStyle(2, 0xffffff, this.getVfxAlpha(0.75));
    this.scene.tweens.add({
      targets: circle,
      scale: 1.18,
      alpha: 0,
      duration: 220,
      onComplete: () => circle.destroy()
    });

    this.damageEnemiesInRadius(x, y, radius, damage, {
      element,
      secondaryElement: options.secondaryElement,
      knockback: options.knockback || 70,
      slowPct: options.slowPct || 0,
      slotRef: options.slotRef,
      petRef: options.petRef,
      isReaction: options.isReaction
    });

    this.scene.spawnSystem?.damageInteractablesNear(x, y, radius, damage);
  }

  damageEnemiesInRadius(x, y, radius, damage, options = {}) {
    const enemies = this.scene.spawnSystem?.enemies || [];
    const rSq = radius * radius;
    const now = performance.now();

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e || e.isDead || !e.sprite?.active) continue;
      const dx = e.sprite.x - x;
      const dy = e.sprite.y - y;
      if (dx * dx + dy * dy <= rSq) {
        if (options.slowPct) {
          e.slowPct = Math.max(e.slowPct, options.slowPct);
          e.slowUntil = Math.max(e.slowUntil, now + 2200);
        }
        this.dealDamageToEnemy(e, damage, {
          ...options,
          fromX: x,
          fromY: y,
          timeMs: now
        });
      }
    }
  }

  pullEnemiesToward(x, y, radius, pullDistance) {
    const enemies = this.scene.spawnSystem?.enemies || [];
    const rSq = radius * radius;
    for (const e of enemies) {
      if (e.isDead || !e.sprite?.active || e.isBoss) continue;
      const dx = x - e.sprite.x;
      const dy = y - e.sprite.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 16 && d2 <= rSq) {
        const d = Math.sqrt(d2);
        const step = Math.min(d * 0.4, pullDistance / Math.max(0.6, e.weight));
        e.sprite.x += (dx / d) * step;
        e.sprite.y += (dy / d) * step;
      }
    }
  }

  spawnGroundZone({
    x,
    y,
    radius,
    duration,
    tickInterval,
    damagePerTick,
    element,
    color,
    slowPct = 0,
    slotRef = null,
    withTotemSprite = false
  }) {
    const graphic = this.scene.add.circle(x, y, radius, color, this.getVfxAlpha(0.28)).setDepth(3);
    graphic.setStrokeStyle(2.2, color, this.getVfxAlpha(0.75));
    let totemSprite = null;
    if (withTotemSprite) {
      totemSprite = this.scene.add.image(x, y - 6, 'proj_totem').setDepth(11);
      totemSprite.setAlpha(this.getVfxAlpha(0.95));
    }
    this.groundZones.push({
      x,
      y,
      radius,
      duration,
      tickInterval,
      damagePerTick,
      element,
      slowPct,
      slotRef,
      graphic,
      totemSprite,
      elapsed: 0,
      tickTimer: tickInterval * 0.8
    });
  }

  firePetProjectile(pet, targetX, targetY, damage, element, aoeRadius = 0) {
    const ox = pet.sprite.x;
    const oy = pet.sprite.y;
    const angle = Math.atan2(targetY - oy, targetX - ox);
    const speed = 480;
    const projSprite = this.scene.add.image(ox, oy, 'projectile_orb');
    projSprite.setDepth(14);
    projSprite.setTint(ELEMENTS[element]?.color || 0xffffff);
    projSprite.setScale(0.75);

    this.playerProjectiles.push({
      sprite: projSprite,
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      speed,
      damage,
      element,
      knockback: 50,
      pierceRemaining: 1,
      aoeRadius: aoeRadius || 24,
      explodeOnHit: aoeRadius > 0,
      maxDuration: 1200,
      elapsed: 0,
      hitSet: new Set(),
      petRef: pet
    });
  }

  fireBeamStrike(ox, oy, tx, ty, damage, element, petRef = null) {
    const color = ELEMENTS[element]?.color || 0x38bdf8;
    const line = this.scene.add
      .line(0, 0, ox, oy, tx, ty, color, this.getVfxAlpha(0.88))
      .setOrigin(0, 0)
      .setLineWidth(3)
      .setDepth(15);
    this.scene.tweens.add({
      targets: line,
      alpha: 0,
      duration: 160,
      onComplete: () => line.destroy()
    });
    this.damageEnemiesInRadius(tx, ty, 38, damage, { element, petRef });
  }

  spawnEnemyProjectile(ox, oy, tx, ty, speed, damage, color = 0xef4444) {
    const angle = Math.atan2(ty - oy, tx - ox);
    const sprite = this.scene.add.image(ox, oy, 'enemy_proj_bolt').setDepth(14);
    sprite.setTint(color);
    sprite.setRotation(angle);
    sprite.setScale(1.05);
    this.enemyProjectiles.push({
      sprite,
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      elapsed: 0
    });
  }

  blockEnemyProjectilesNear(x, y, radius) {
    const rSq = radius * radius;
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      const dx = ep.x - x;
      const dy = ep.y - y;
      if (dx * dx + dy * dy <= rSq) {
        ep.sprite.destroy();
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  triggerVoltDashDischarge(x, y) {
    this.triggerAoEExplosion(x, y, 125, Math.round(38 * this.scene.player.damageMult), 'lightning', {
      color: 0xfacc15
    });
    const enemies = this.scene.spawnSystem?.enemies || [];
    const now = performance.now();
    for (const e of enemies) {
      if (!e.isDead && e.sprite?.active && Math.hypot(e.sprite.x - x, e.sprite.y - y) <= 135) {
        e.applyStun(1100, now);
      }
    }
  }

  triggerSolariusSupernova(x, y) {
    this.spawnFloatingText(x, y - 34, 'SUPERNOVA SAGRADA!', '#fbbf24');
    this.triggerAoEExplosion(x, y, 165, Math.round(65 * this.scene.player.damageMult), 'fire', {
      color: 0xfbbf24,
      knockback: 220
    });
  }

  triggerFairyShieldExplosion(x, y, petRef = null) {
    const basePlayerDmg = 28 * (this.scene.player?.damageMult || 1);
    const dmg = Math.round(50 + basePlayerDmg * 0.10);
    this.triggerAoEExplosion(x, y, 130, dmg, 'arcane', {
      color: 0xfef08a,
      petRef
    });
  }

  spawnDamageNumber(x, y, amount, isCrit = false) {
    const scatterX = (Math.random() - 0.5) * 20;
    const scatterY = (Math.random() - 0.5) * 10;
    const color = isCrit ? '#fde047' : '#ffffff';
    const textStr = isCrit ? `💥${amount}` : `${amount}`;
    const fontSize = isCrit ? '15px' : '12px';
    const txt = this.scene.add
      .text(x + scatterX, y - 14 + scatterY, textStr, {
        fontFamily: 'system-ui, sans-serif',
        fontSize,
        fontStyle: 'bold',
        color,
        stroke: '#090a10',
        strokeThickness: isCrit ? 3.5 : 2.5
      })
      .setOrigin(0.5)
      .setDepth(24);

    this.scene.tweens.add({
      targets: txt,
      y: y - 38 + scatterY,
      alpha: 0,
      duration: isCrit ? 750 : 550,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy()
    });
  }

  spawnFloatingText(x, y, message, colorHex = '#ffffff') {
    const txt = this.scene.add
      .text(x, y, message, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: colorHex,
        stroke: '#090a10',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(25);

    this.scene.tweens.add({
      targets: txt,
      y: y - 28,
      alpha: 0,
      duration: 750,
      onComplete: () => txt.destroy()
    });
  }
}

export default CombatSystem;
