import assert from 'node:assert/strict';
import { CHARACTERS_DATA } from '../src/config/charactersData.js';
import {
  ACTIVE_SKILLS,
  PASSIVE_SKILLS,
  SYNERGY_EVOLUTIONS,
  DUAL_FUSIONS,
  LIMIT_BREAK_OPTIONS,
  getXpRequiredForLevel,
  rollCardRarity
} from '../src/config/skillsData.js';
import {
  ELEMENTS,
  ELEMENTAL_REACTIONS,
  resolveElementalReaction
} from '../src/config/elementsData.js';
import {
  ENEMY_TYPES,
  HORDE_EVENTS,
  PETS_DATA,
  CHEST_DROP_ITEMS,
  getBonusKills,
  getForceMultiplier,
  getScaledEnemyHp,
  getScaledXpDrop
} from '../src/config/enemiesData.js';

console.log('=== [elemental-balance-sim] Starting Mathematical & Combinatorial Validation ===');

// 1. Validate 10 Characters
assert.equal(CHARACTERS_DATA.length, 10, 'Must have exactly 10 characters');
assert.equal(CHARACTERS_DATA[0].id, 'petrus', 'First character must be Petrus');
assert.equal(CHARACTERS_DATA[0].unlockedByDefault, true, 'Petrus must be unlocked by default');
assert.equal(CHARACTERS_DATA[0].hasFourArms, true, 'Petrus must have 4 articulated arms');

const charIds = new Set();
for (const char of CHARACTERS_DATA) {
  assert(!charIds.has(char.id), `Duplicate character ID: ${char.id}`);
  charIds.add(char.id);
  assert(ELEMENTS[char.element], `Invalid element ${char.element} on ${char.id}`);
  const starter = ACTIVE_SKILLS.find((s) => s.id === char.starterSkillId);
  assert(starter, `Missing starter skill ${char.starterSkillId} for character ${char.id}`);
}
console.log('✔ 10 Elemental Characters verified (Petrus #1 unlocked, unique IDs, valid starters).');

// 2. Validate Skills, Passives, Evolutions & Fusions
assert.equal(ACTIVE_SKILLS.length, 12, 'Must have 12 active skills');
const corePassives = PASSIVE_SKILLS.filter((p) => p.category === 'core');
assert.equal(corePassives.length, 10, 'Must have 10 core passive skills');
assert.equal(PASSIVE_SKILLS.length, 12, 'Must have 12 total passive skills covering all 12 evolution recipes');
assert.equal(SYNERGY_EVOLUTIONS.length, 12, 'Must have 12 Active+Passive evolutions');
assert.equal(DUAL_FUSIONS.length, 6, 'Must have 6 Active+Active fusions');

const allSkillIds = new Set();
for (const item of [...ACTIVE_SKILLS, ...PASSIVE_SKILLS, ...SYNERGY_EVOLUTIONS, ...DUAL_FUSIONS]) {
  assert(!allSkillIds.has(item.id), `Duplicate skill/evolution ID: ${item.id}`);
  allSkillIds.add(item.id);
}

for (const evo of SYNERGY_EVOLUTIONS) {
  const act = ACTIVE_SKILLS.find((a) => a.id === evo.activeId);
  const pas = PASSIVE_SKILLS.find((p) => p.id === evo.passiveId);
  assert(act, `Evolution ${evo.id} references invalid activeId ${evo.activeId}`);
  assert(pas, `Evolution ${evo.id} references invalid passiveId ${evo.passiveId}`);
  assert.equal(evo.freesSlot, 'passive', `Evolution ${evo.id} must free 1 passive slot`);
}

for (const fus of DUAL_FUSIONS) {
  const actA = ACTIVE_SKILLS.find((a) => a.id === fus.activeAId);
  const actB = ACTIVE_SKILLS.find((a) => a.id === fus.activeBId);
  assert(actA, `Fusion ${fus.id} references invalid activeAId ${fus.activeAId}`);
  assert(actB, `Fusion ${fus.id} references invalid activeBId ${fus.activeBId}`);
  assert.notEqual(fus.activeAId, fus.activeBId, `Fusion ${fus.id} cannot fuse a skill with itself`);
  assert.equal(fus.freesSlot, 'active', `Fusion ${fus.id} must free 1 active slot`);
}
console.log('✔ 12 Actives, 10+2 Passives, 12 Evolutions (★), and 6 Dual Fusions (★★) verified.');

// 3. Validate 7 Elements & 7 Reactions
assert.equal(Object.keys(ELEMENTS).length, 7, 'Must have 7 elements');
assert.equal(ELEMENTAL_REACTIONS.length, 7, 'Must have 7 elemental reactions');

assert.equal(resolveElementalReaction('earth', 'fire')?.id, 'magma_eruption');
assert.equal(resolveElementalReaction('ice', 'earth')?.id, 'rock_shatter');
assert.equal(resolveElementalReaction('fire', 'ice')?.id, 'thermal_shock');
assert.equal(resolveElementalReaction('poison', 'fire')?.id, 'toxic_combustion');
assert.equal(resolveElementalReaction('ice', 'lightning')?.id, 'superconductor');
assert.equal(resolveElementalReaction('wind', 'fire')?.id, 'elemental_whirlwind');
assert.equal(resolveElementalReaction('arcane', 'earth')?.id, 'dimensional_rupture');
assert.equal(resolveElementalReaction('fire', 'fire'), null, 'Same element should not trigger cross-reaction');
console.log('✔ 7 Elements & 7 Elemental Cross-Reactions verified.');

// 4. Validate XP Curve & Endless Scaling Formulas
assert.equal(getXpRequiredForLevel(1), 25, 'Level 1 XP should be floor(15*1 + 10) = 25');
assert.equal(getXpRequiredForLevel(10), Math.floor(15 * Math.pow(10, 1.28) + 100));

// Kill cap verification: at T=2 minutes, 100,000 kills must cap BonusKills at T * 0.25 = 0.50
const bonusCapped = getBonusKills(2, 100000);
assert.equal(bonusCapped, 0.5, 'BonusKills at T=2 must cap at 2 * 0.25 = 0.50');
const forceMult = getForceMultiplier(2, 100000);
assert(Math.abs(forceMult - (1 + 0.6 + 0.5)) < 1e-9, 'ForceMultiplier at T=2 with capped kills must be 2.10');
assert(getScaledEnemyHp(100, 5, 500) > 100, 'Enemy HP scales with time and kills');
assert(getScaledXpDrop(10, 5, 500) > 10, 'XP drop scales with time and kills');
assert.equal(ENEMY_TYPES.length >= 6, true);
assert.equal(HORDE_EVENTS.length, 4);
assert.equal(PETS_DATA.length, 6);
assert.equal(CHEST_DROP_ITEMS.length, 6);
console.log('✔ XP Curve & Capped Endless Scaling equations verified.');

// 5. Monte Carlo Simulation of 100 Runs (5+5 Slots, Evolution/Fusion Slot Liberation, Limit Break)
for (let run = 0; run < 100; run++) {
  const char = CHARACTERS_DATA[run % CHARACTERS_DATA.length];
  const activeSlots = new Map(); // skillId -> { level, evolved }
  const passiveSlots = new Map(); // skillId -> { level }
  const consumedSkills = new Set();
  const banishedSkills = new Set();

  activeSlots.set(char.starterSkillId, { level: 1, isEvolution: false });

  for (let lvl = 2; lvl <= 65; lvl++) {
    // Check guaranteed Evolutions or Fusions
    let guaranteedApplied = false;

    for (const fus of DUAL_FUSIONS) {
      const a = activeSlots.get(fus.activeAId);
      const b = activeSlots.get(fus.activeBId);
      if (a && a.level >= 5 && b && b.level >= 5 && !activeSlots.has(fus.id) && !consumedSkills.has(fus.id)) {
        activeSlots.delete(fus.activeAId);
        activeSlots.delete(fus.activeBId);
        consumedSkills.add(fus.activeAId);
        consumedSkills.add(fus.activeBId);
        activeSlots.set(fus.id, { level: 5, isEvolution: true });
        assert(activeSlots.size <= 4, 'Dual fusion must free 1 active slot');
        guaranteedApplied = true;
        break;
      }
    }

    if (!guaranteedApplied) {
      for (const evo of SYNERGY_EVOLUTIONS) {
        const a = activeSlots.get(evo.activeId);
        const p = passiveSlots.get(evo.passiveId);
        if (a && a.level >= 5 && p && p.level >= 5 && !activeSlots.has(evo.id) && !consumedSkills.has(evo.id)) {
          activeSlots.delete(evo.activeId);
          passiveSlots.delete(evo.passiveId);
          consumedSkills.add(evo.activeId);
          consumedSkills.add(evo.passiveId);
          activeSlots.set(evo.id, { level: 5, isEvolution: true });
          assert(passiveSlots.size <= 4, 'Synergy evolution must free 1 passive slot');
          guaranteedApplied = true;
          break;
        }
      }
    }

    if (guaranteedApplied) continue;

    // Candidate pool respecting 5 Active and 5 Passive limits
    const candidates = [];
    for (const act of ACTIVE_SKILLS) {
      if (consumedSkills.has(act.id) || banishedSkills.has(act.id)) continue;
      const existing = activeSlots.get(act.id);
      if (existing) {
        if (existing.level < 5) candidates.push({ type: 'active', id: act.id });
      } else if (activeSlots.size < 5) {
        candidates.push({ type: 'active', id: act.id });
      }
    }

    for (const pas of PASSIVE_SKILLS) {
      if (consumedSkills.has(pas.id) || banishedSkills.has(pas.id)) continue;
      const existing = passiveSlots.get(pas.id);
      if (existing) {
        if (existing.level < 5) candidates.push({ type: 'passive', id: pas.id });
      } else if (passiveSlots.size < 5) {
        candidates.push({ type: 'passive', id: pas.id });
      }
    }

    if (candidates.length === 0) {
      assert(LIMIT_BREAK_OPTIONS.length === 3, 'Limit break options must be available when slots are maxed');
      continue;
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const rarity = rollCardRarity(char.stats.luckMult || 1.0);
    if (pick.type === 'active') {
      const cur = activeSlots.get(pick.id)?.level || 0;
      activeSlots.set(pick.id, { level: Math.min(5, cur + rarity.levelJump), isEvolution: false });
    } else {
      const cur = passiveSlots.get(pick.id)?.level || 0;
      passiveSlots.set(pick.id, { level: Math.min(5, cur + rarity.levelJump) });
    }

    assert(activeSlots.size <= 5, `Active slots exceeded 5 (${activeSlots.size})`);
    assert(passiveSlots.size <= 5, `Passive slots exceeded 5 (${passiveSlots.size})`);
  }
}
console.log('✔ 100 Monte Carlo Level-Up Runs (Lv.1 -> Lv.65) completed with 0 deadlocks or slot overflows.');
console.log('=== [elemental-balance-sim] ALL CHECKS PASSED ===');
