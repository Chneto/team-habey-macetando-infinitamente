import { CHARACTERS_DATA } from '../config/charactersData.js';
import {
  ACTIVE_SKILLS,
  PASSIVE_SKILLS,
  SYNERGY_EVOLUTIONS,
  DUAL_FUSIONS
} from '../config/skillsData.js';

const STORAGE_KEY = 'team_habey_save_v1';

export const TALENT_SHOP_ITEMS = [
  {
    id: 'elemental_power',
    name: '+Força Elemental',
    icon: '🔥',
    maxLevel: 5,
    baseCost: 120,
    costScale: 1.5,
    bonusPerLevel: 0.10,
    description: '+10% de Dano Global por nível em todas as habilidades e reações.'
  },
  {
    id: 'arcane_luck',
    name: '+Sorte Arcana',
    icon: '🍀',
    maxLevel: 5,
    baseCost: 110,
    costScale: 1.5,
    bonusPerLevel: 0.10,
    description: '+10% de Sorte para cartas Raras/Épicas/Lendárias e baús por nível.'
  },
  {
    id: 'base_speed',
    name: '+Velocidade Base',
    icon: '🥾',
    maxLevel: 5,
    baseCost: 100,
    costScale: 1.45,
    bonusPerLevel: 0.05,
    description: '+5% de Velocidade de movimento por nível.'
  },
  {
    id: 'casting_speed',
    name: '+Velocidade de Casting',
    icon: '⚡',
    maxLevel: 5,
    baseCost: 140,
    costScale: 1.55,
    bonusPerLevel: 0.06,
    description: '-6% de Tempo de recarga de habilidades por nível.'
  },
  {
    id: 'extra_shot',
    name: '+Disparo Adicional',
    icon: '🏹',
    maxLevel: 3,
    baseCost: 320,
    costScale: 2.0,
    bonusPerLevel: 1,
    description: '+1 Projétil base em todas as habilidades ativas por nível.'
  },
  {
    id: 'supreme_tamer',
    name: '+Domador Supremo',
    icon: '🐾',
    maxLevel: 3,
    baseCost: 240,
    costScale: 1.75,
    bonusPerLevel: 1,
    description: '+1 Limite de Pets resgatados e +20% de poder dos Pets por nível.'
  },
  {
    id: 'ethereal_breath',
    name: '+Fôlego Etéreo',
    icon: '💨',
    maxLevel: 3,
    baseCost: 200,
    costScale: 1.7,
    bonusPerLevel: 1,
    description: '+1 Carga de Dash e +15% de recuperação de Stamina por nível.'
  },
  {
    id: 'elemental_cloning',
    name: '🌟 Clonagem Elemental',
    icon: '👥',
    maxLevel: 3,
    baseCost: 500,
    costScale: 2.2,
    bonusPerLevel: 1,
    isUltimate: true,
    description: 'Invoca Clones Espectrais permanentes (1 a 3) que caminham em formação e disparam cópias exatas de todas as suas habilidades ativas!'
  }
];

export const ACHIEVEMENTS_DATA = [
  {
    id: 'first_blood',
    name: 'Batismo Elemental',
    icon: '⚔️',
    description: 'Derrote 100 inimigos em uma única partida.'
  },
  {
    id: 'synergy_master',
    name: 'Alquimista Sinérgico',
    icon: '★',
    description: 'Desbloqueie sua primeira Evolução Suprema (Ativa + Passiva Nv.5).'
  },
  {
    id: 'fusion_archon',
    name: 'Arconte da Fusão Dupla',
    icon: '★★',
    description: 'Realize uma Fusão Dupla de Armas (Ativa A Nv.5 + Ativa B Nv.5).'
  },
  {
    id: 'boss_slayer',
    name: 'Matador de Titãs',
    icon: '💀',
    description: 'Derrote um Boss Principal antes da Maldição de Sangue de 3 minutos.'
  },
  {
    id: 'pack_rescuer',
    name: 'Libertador de Feras',
    icon: '🐾',
    description: 'Resgate um Pet Autônomo quebrando uma Jaula Mágica.'
  },
  {
    id: 'clone_legion',
    name: 'Legião Espectral',
    icon: '👥',
    description: 'Adquira pelo menos 1 nível de Clonagem Elemental na Loja de Talentos.'
  }
];

function createDefaultSave() {
  return {
    version: 1,
    gold: 250,
    selectedCharacterId: 'petrus',
    unlockedCharacters: ['petrus'],
    talents: {
      elemental_power: 0,
      arcane_luck: 0,
      base_speed: 0,
      casting_speed: 0,
      extra_shot: 0,
      supreme_tamer: 0,
      ethereal_breath: 0,
      elemental_cloning: 0
    },
    grimoireDiscovered: ['rock_barrage', 'titan_glove'],
    achievements: [],
    stats: {
      totalKills: 0,
      totalRuns: 0,
      bestTimeSeconds: 0,
      highestLevel: 1
    },
    settings: {
      vfxOpacity: 1.0,
      muted: false
    },
    lastUpdated: Date.now()
  };
}

class SaveManager {
  constructor() {
    this.data = this.load();
    this.firebaseConnected = false;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const def = createDefaultSave();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(def));
        return def;
      }
      const parsed = JSON.parse(raw);
      const def = createDefaultSave();
      return {
        ...def,
        ...parsed,
        talents: { ...def.talents, ...(parsed.talents || {}) },
        stats: { ...def.stats, ...(parsed.stats || {}) },
        settings: { ...def.settings, ...(parsed.settings || {}) }
      };
    } catch (_err) {
      return createDefaultSave();
    }
  }

  save() {
    this.data.lastUpdated = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (_err) {
      // Ignore quota errors in restricted environments
    }
    this.syncWithFirebase();
    window.dispatchEvent(new CustomEvent('habey:save-updated', { detail: this.data }));
  }

  async syncWithFirebase() {
    if (!window.FIREBASE_CONFIG || !window.FIREBASE_SYNC_URL) return false;
    try {
      this.firebaseConnected = true;
      return true;
    } catch (_err) {
      return false;
    }
  }

  getGold() {
    return this.data.gold || 0;
  }

  addGold(amount) {
    this.data.gold = Math.max(0, Math.floor((this.data.gold || 0) + amount));
    this.save();
    return this.data.gold;
  }

  isCharacterUnlocked(charId) {
    if (charId === 'petrus') return true;
    return this.data.unlockedCharacters.includes(charId);
  }

  unlockCharacter(charId) {
    const char = CHARACTERS_DATA.find((c) => c.id === charId);
    if (!char) return false;
    if (this.isCharacterUnlocked(charId)) return true;
    if (this.data.gold < char.unlockCost) return false;

    this.data.gold -= char.unlockCost;
    this.data.unlockedCharacters.push(charId);
    this.discoverItem(char.starterSkillId);
    this.save();
    return true;
  }

  selectCharacter(charId) {
    if (!this.isCharacterUnlocked(charId)) return false;
    this.data.selectedCharacterId = charId;
    this.save();
    return true;
  }

  getSelectedCharacterId() {
    return this.data.selectedCharacterId || 'petrus';
  }

  getTalentLevel(talentId) {
    return this.data.talents[talentId] || 0;
  }

  getTalentCost(talentId) {
    const item = TALENT_SHOP_ITEMS.find((t) => t.id === talentId);
    if (!item) return 999999;
    const lvl = this.getTalentLevel(talentId);
    if (lvl >= item.maxLevel) return null;
    return Math.floor(item.baseCost * Math.pow(item.costScale, lvl));
  }

  buyTalent(talentId) {
    const item = TALENT_SHOP_ITEMS.find((t) => t.id === talentId);
    if (!item) return false;
    const lvl = this.getTalentLevel(talentId);
    if (lvl >= item.maxLevel) return false;
    const cost = this.getTalentCost(talentId);
    if (this.data.gold < cost) return false;

    this.data.gold -= cost;
    this.data.talents[talentId] = lvl + 1;
    if (talentId === 'elemental_cloning') {
      this.unlockAchievement('clone_legion');
    }
    this.save();
    return true;
  }

  getTalentBonuses() {
    const t = this.data.talents;
    return {
      damageMult: (t.elemental_power || 0) * 0.10,
      luckMult: (t.arcane_luck || 0) * 0.10,
      moveSpeedMult: (t.base_speed || 0) * 0.05,
      cooldownReduction: (t.casting_speed || 0) * 0.06,
      extraProjectiles: t.extra_shot || 0,
      petLimitBonus: t.supreme_tamer || 0,
      petPowerMult: (t.supreme_tamer || 0) * 0.20,
      extraDashCharges: t.ethereal_breath || 0,
      staminaRegenMult: (t.ethereal_breath || 0) * 0.15,
      cloneCount: t.elemental_cloning || 0
    };
  }

  discoverItem(id) {
    if (!id) return;
    if (!this.data.grimoireDiscovered.includes(id)) {
      this.data.grimoireDiscovered.push(id);
      this.save();
    }
  }

  unlockAchievement(achId) {
    if (!this.data.achievements.includes(achId)) {
      this.data.achievements.push(achId);
      this.save();
      return true;
    }
    return false;
  }

  recordRunEnd({ timeSeconds, level, kills, goldEarned }) {
    this.data.stats.totalRuns += 1;
    this.data.stats.totalKills += kills;
    this.data.stats.lastRunGoldEarned = Math.floor(goldEarned || 0);
    if (timeSeconds > this.data.stats.bestTimeSeconds) {
      this.data.stats.bestTimeSeconds = Math.floor(timeSeconds);
    }
    if (level > this.data.stats.highestLevel) {
      this.data.stats.highestLevel = level;
    }
    if (kills >= 100) this.unlockAchievement('first_blood');
    this.save();
  }

  setVfxOpacity(opacity) {
    this.data.settings.vfxOpacity = Math.max(0.2, Math.min(1.0, Number(opacity) || 1.0));
    this.save();
  }

  getVfxOpacity() {
    return this.data.settings.vfxOpacity ?? 1.0;
  }

  /**
   * Debug Button #10: +10.000 Gold & Unlock all 10 Characters / Grimoire / Achievements
   */
  unlockAllDebug() {
    this.data.gold += 10000;
    this.data.unlockedCharacters = CHARACTERS_DATA.map((c) => c.id);
    const allIds = [
      ...ACTIVE_SKILLS.map((s) => s.id),
      ...PASSIVE_SKILLS.map((s) => s.id),
      ...SYNERGY_EVOLUTIONS.map((s) => s.id),
      ...DUAL_FUSIONS.map((s) => s.id)
    ];
    this.data.grimoireDiscovered = Array.from(new Set([...this.data.grimoireDiscovered, ...allIds]));
    this.data.achievements = ACHIEVEMENTS_DATA.map((a) => a.id);
    this.save();
  }
}

export const saveManager = new SaveManager();
export default saveManager;
