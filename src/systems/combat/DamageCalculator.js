/**
 * DamageCalculator.js
 * Módulo de cálculo matemático de dano, críticos, afinidades elementais e reduções.
 */

export class DamageCalculator {
  static computeHitDamage({
    rawDamage,
    player,
    enemy,
    weaponElement = null,
    guaranteedCrit = false,
    critBonusChance = 0
  }) {
    let damage = Math.max(1, rawDamage);

    // 1. Player base and talent multipliers
    if (player) {
      const dmgBonus = player.damageMultiplier || 1.0;
      damage *= dmgBonus;
    }

    // 2. Critical hit calculation
    let isCrit = false;
    if (player) {
      const baseCritChance = (player.critChance || 0.05) + critBonusChance;
      const roll = Math.random();
      if (guaranteedCrit || roll < baseCritChance) {
        isCrit = true;
        const critMult = player.critMultiplier || 1.8;
        damage *= critMult;
      }
    }

    // 3. Enemy Affixes & Armor
    if (enemy) {
      if (enemy.armorReduction > 0) {
        damage *= (1 + enemy.armorReduction);
      }
      if (enemy.isArmored) {
        damage *= 0.75; // Armored affixes reduce direct damage by 25%
      }

      // 4. Boss Elemental Resistances and Vulnerabilities
      if (weaponElement && enemy.elementalResistances) {
        const res = enemy.elementalResistances[weaponElement];
        if (typeof res === 'number') {
          damage *= (1.0 - res);
        }
      }
    }

    const finalDamage = Math.max(1, Math.round(damage));
    return {
      finalDamage,
      isCrit
    };
  }
}

export default DamageCalculator;
