/**
 * ElementalReactionMatrix.js
 * Gerenciador e executor das 7 Reações Elementais do Team Habey.
 */

import { resolveElementalReaction } from '../../config/elementsData.js';
import soundManager from '../SoundManager.js';

export class ElementalReactionMatrix {
  static trigger({
    combatSystem,
    enemy,
    firstElem,
    secondElem,
    baseHitDamage,
    timeMs
  }) {
    const reaction = resolveElementalReaction(firstElem, secondElem);
    if (!reaction || !enemy.sprite?.active) return null;

    const ex = enemy.sprite.x;
    const ey = enemy.sprite.y;
    const player = combatSystem.scene.player;

    // Alchemius Innate Passive: Catalisador Químico (+45% reaction damage & spread)
    const alchemiusMult = player?.characterData.id === 'alchemius' ? 1.45 : 1.0;
    const reactionDmg = Math.max(8, Math.round(baseHitDamage * reaction.damageMult * alchemiusMult));

    soundManager.playReaction();
    combatSystem.spawnFloatingText(ex, ey - 26, `${reaction.name}!`, reaction.hex);

    // Consume element status unless reaction specifies persistence
    enemy.activeElement = null;

    switch (reaction.id) {
      case 'magma_eruption': {
        combatSystem.spawnGroundZone({
          x: ex,
          y: ey,
          radius: reaction.radius,
          duration: reaction.duration,
          tickInterval: 500,
          damagePerTick: Math.round(reactionDmg * 0.45),
          element: 'fire',
          color: reaction.color,
          slowPct: 0.40
        });
        break;
      }

      case 'rock_shatter': {
        combatSystem.damageEnemiesInRadius(ex, ey, reaction.radius, reactionDmg, {
          guaranteedCrit: true,
          knockback: 260,
          isReaction: true
        });
        break;
      }

      case 'thermal_shock': {
        enemy.armorReduction = Math.max(enemy.armorReduction || 0, 0.30);
        combatSystem.triggerAoEExplosion(ex, ey, reaction.radius, reactionDmg, null, {
          isReaction: true,
          color: reaction.color
        });
        break;
      }

      case 'toxic_combustion': {
        combatSystem.triggerAoEExplosion(ex, ey, reaction.radius, reactionDmg, 'poison', {
          isReaction: true,
          color: reaction.color
        });
        break;
      }

      case 'superconductor': {
        combatSystem.castChainLightning(ex, ey, 1, reactionDmg, reaction.chainTargets, null, null);
        if (player) {
          for (const slot of player.activeSkills.values()) {
            slot.cooldownTimer = Math.max(0, slot.cooldownTimer - reaction.cooldownReductionMs);
          }
        }
        break;
      }

      case 'elemental_whirlwind': {
        const effRadius = Math.round(reaction.radius * 1.5);
        combatSystem.pullEnemiesToward(ex, ey, effRadius, 95);
        combatSystem.triggerAoEExplosion(ex, ey, effRadius, reactionDmg, reaction.combinedWith, {
          isReaction: true,
          color: reaction.color
        });
        break;
      }

      case 'dimensional_rupture': {
        enemy.vulnerabilityBonus = Math.max(enemy.vulnerabilityBonus || 0, 0.25);
        combatSystem.dealDamageToEnemy(enemy, reactionDmg, { isReaction: true, timeMs });
        break;
      }

      default:
        break;
    }

    // Alchemius spreads residual element to nearby enemies
    if (player?.characterData.id === 'alchemius') {
      const enemies = combatSystem.scene.spawnSystem?.enemies || [];
      for (const other of enemies) {
        if (other !== enemy && !other.isDead && other.sprite?.active) {
          const d = Math.hypot(other.sprite.x - ex, other.sprite.y - ey);
          if (d <= 140) {
            other.applyElementStatus(secondElem, timeMs);
          }
        }
      }
    }

    combatSystem.reactionDamageTotal += reactionDmg;
    return reaction;
  }
}

export default ElementalReactionMatrix;
