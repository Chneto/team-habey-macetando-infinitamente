export function getBonusKills(minuteT, killsK) {
  const T = Math.max(0, minuteT);
  const K = Math.max(0, killsK);
  return Math.min(K * 0.0015, T * 0.25);
}

export function getForceMultiplier(minuteT, killsK) {
  const T = Math.max(0, minuteT);
  return 1 + T * 0.30 + getBonusKills(T, killsK);
}

export function getScaledEnemyHp(baseHp, minuteT, killsK) {
  return Math.round(baseHp * getForceMultiplier(minuteT, killsK));
}

export function getScaledXpDrop(baseXp, minuteT, killsK) {
  const T = Math.max(0, minuteT);
  const bonus = getBonusKills(T, killsK);
  return Math.max(1, Math.round(baseXp * (1 + T * 0.22 + bonus * 0.5)));
}

export const ENEMY_TYPES = [
  {
    id: 'goblin_runner',
    name: 'Duende Saqueador',
    roleLabel: 'Saqueador Veloz',
    visualTrait: 'Orelhas pontiagudas, saco de pilhagem e adaga enferrujada',
    spriteKey: 'enemy_goblin',
    hp: 54,
    speed: 116,
    damage: 13,
    weight: 0.9,
    xp: 6,
    scale: 1.0,
    color: 0x65a30d,
    ranged: false,
    resistances: {},
    vulnerabilities: { fire: 0.25 }
  },
  {
    id: 'skeleton_warrior',
    name: 'Esqueleto Rúnico',
    roleLabel: 'Infantaria Óssea',
    visualTrait: 'Crânio rúnico, costelas expostas, espada larga e escudo',
    spriteKey: 'enemy_skeleton',
    hp: 82,
    speed: 96,
    damage: 16,
    weight: 1.1,
    xp: 9,
    scale: 1.05,
    color: 0x94a3b8,
    ranged: false,
    resistances: { poison: 0.35 },
    vulnerabilities: { earth: 0.35 }
  },
  {
    id: 'stone_golem',
    name: 'Escudeiro de Basalto',
    roleLabel: 'Colosso Blindado',
    visualTrait: 'Corpo maciço de rocha vulcânica com fissuras de magma',
    spriteKey: 'enemy_golem',
    hp: 180,
    speed: 68,
    damage: 24,
    weight: 2.4,
    xp: 16,
    scale: 1.25,
    color: 0x78716c,
    ranged: false,
    resistances: { lightning: 0.35 },
    vulnerabilities: { ice: 0.35, arcane: 0.25 }
  },
  {
    id: 'arcane_cultist',
    name: 'Cultista Abissal',
    roleLabel: 'Artilheiro do Vazio',
    visualTrait: 'Capuz chifrudo de 3 olhos e cajado de crânio abissal',
    spriteKey: 'enemy_cultist',
    hp: 105,
    speed: 82,
    damage: 18,
    weight: 1.0,
    xp: 14,
    scale: 1.05,
    color: 0x9333ea,
    ranged: true,
    fireInterval: 2200,
    projectileSpeed: 245,
    resistances: { arcane: 0.40 },
    vulnerabilities: { wind: 0.35 }
  },
  {
    id: 'lightning_stalker',
    name: 'Corredor Relâmpago',
    roleLabel: 'Fera Voltaica',
    visualTrait: 'Predador quadrúpede com espinhos dorsais elétricos',
    spriteKey: 'enemy_stalker',
    hp: 74,
    speed: 180,
    damage: 16,
    weight: 0.8,
    xp: 12,
    scale: 0.98,
    color: 0xfacc15,
    ranged: false,
    resistances: { lightning: 0.50 },
    vulnerabilities: { earth: 0.50 }
  },
  {
    id: 'shadow_assassin',
    name: 'Assassino das Sombras',
    roleLabel: 'Ceifador Oni',
    visualTrait: 'Máscara demoníaca Oni, cachecol rubro e lâminas duplas Katar',
    spriteKey: 'enemy_assassin',
    hp: 125,
    speed: 146,
    damage: 22,
    weight: 0.95,
    xp: 18,
    scale: 1.05,
    color: 0x4c1d95,
    ranged: true,
    fireInterval: 1900,
    projectileSpeed: 280,
    resistances: { arcane: 0.30 },
    vulnerabilities: { fire: 0.40 }
  }
];

export const HORDE_EVENTS = [
  {
    minuteMod: 2,
    id: 'iron_ring',
    name: 'Anel de Ferro',
    bannerColor: '#f59e0b',
    count: 60,
    enemyId: 'stone_golem',
    description: '60 golems e escudeiros surgem formando um círculo fechado que se contrai lentamente ao redor do jogador!'
  },
  {
    minuteMod: 5,
    id: 'lightning_stampede',
    name: 'Debandada Relâmpago',
    bannerColor: '#ef4444',
    count: 36,
    enemyId: 'lightning_stalker',
    description: 'Faixas vermelhas piscam no chão seguidas por ondas de corredores ultra-rápidos cruzando a tela!'
  },
  {
    minuteMod: 7,
    id: 'elemental_convergence',
    name: 'Convergência Elemental',
    bannerColor: '#38bdf8',
    count: 42,
    enemyId: 'skeleton_warrior',
    description: 'Hordas imbuídas com afinidade elemental atacam em sincronia!'
  },
  {
    minuteMod: 9,
    id: 'shadow_siege',
    name: 'Cerco das Sombras',
    bannerColor: '#a855f7',
    count: 32,
    enemyId: 'shadow_assassin',
    description: 'Assassinos e magos atiradores surgem em formação espiral disparando projéteis coordenados!'
  }
];

export const BOSS_AFFIXES = [
  {
    id: 'vampiric',
    name: 'Vampírico',
    color: '#ef4444',
    description: 'Drena essência vital e regenera HP periodicamente.'
  },
  {
    id: 'teleporter',
    name: 'Teletransportador',
    color: '#38bdf8',
    description: 'Salta pelo espaço rúnico aproximando-se do jogador.'
  },
  {
    id: 'reflector_shield',
    name: 'Escudo Refletor',
    color: '#fbbf24',
    description: 'Ergue escudo prismático temporário que reduz dano e dispara projéteis.'
  },
  {
    id: 'berserker',
    name: 'Berserker',
    color: '#f97316',
    description: 'Ganha +40% velocidade e ataque quando abaixo de 50% de HP.'
  },
  {
    id: 'summoner',
    name: 'Invocador',
    color: '#a855f7',
    description: 'Evoca guardiões elementais periodicamente ao seu redor.'
  }
];

export const MINI_BOSS_TEMPLATES = [
  {
    id: 'miniboss_frost_warden',
    name: 'Carcereiro da Geada',
    roleLabel: 'Mini-Boss Glacial',
    visualTrait: 'Armadura de placas de gelo eterno, coroa de estalactites e alabarda criogênica.',
    spriteKey: 'boss_frost_warden',
    hp: 2200,
    speed: 92,
    damage: 34,
    weight: 4.5,
    xp: 220,
    gold: 85,
    scale: 1.55,
    tint: 0x38bdf8,
    resistElement: 'ice',
    vulnerableElements: ['earth', 'fire'],
    affinityLabel: 'Resistente a Gelo [-50%] | Vulnerável a Terra/Fogo [+50%]'
  },
  {
    id: 'miniboss_magma_colossus',
    name: 'Colosso de Escória',
    roleLabel: 'Mini-Boss Vulcânico',
    visualTrait: 'Titã de basalto negro com fornalha de magma exposta no peito e punhos incandescentes.',
    spriteKey: 'boss_magma_colossus',
    hp: 2700,
    speed: 84,
    damage: 38,
    weight: 5.5,
    xp: 260,
    gold: 105,
    scale: 1.65,
    tint: 0xf97316,
    resistElement: 'fire',
    vulnerableElements: ['ice', 'wind'],
    affinityLabel: 'Resistente a Fogo [-50%] | Vulnerável a Gelo/Vento [+50%]'
  },
  {
    id: 'miniboss_plague_alchemist',
    name: 'Arauto da Peste Verde',
    roleLabel: 'Mini-Boss Tóxico',
    visualTrait: 'Alquimista corrompido com tanques dorsais de ácido fervente e incensário de esporos.',
    spriteKey: 'boss_plague_alchemist',
    hp: 2400,
    speed: 96,
    damage: 36,
    weight: 4.0,
    xp: 240,
    gold: 95,
    scale: 1.55,
    tint: 0x84cc16,
    resistElement: 'poison',
    vulnerableElements: ['fire', 'lightning'],
    affinityLabel: 'Resistente a Veneno [-50%] | Vulnerável a Fogo/Raio [+50%]'
  }
];

export const MAIN_BOSS_TEMPLATES = [
  {
    id: 'boss_malakor_ash_titan',
    name: 'Malakor, Arconte da Cinza e Obsidiana',
    roleLabel: 'Arconte Supremo (Fogo)',
    visualTrait: 'Soberano demoníaco de obsidiana com asas vulcânicas, chifres de brasa e lança solar.',
    spriteKey: 'boss_malakor',
    hp: 7200,
    speed: 88,
    damage: 48,
    weight: 10.0,
    xp: 680,
    gold: 260,
    scale: 2.1,
    tint: 0xff5722,
    resistElement: 'fire',
    vulnerableElements: ['ice', 'earth'],
    affinityLabel: 'Resistente a Fogo [-50%] | Vulnerável a Gelo/Terra [+50%]'
  },
  {
    id: 'boss_vorath_void_sovereign',
    name: 'Vorath, Soberano do Eclipse Abissal',
    roleLabel: 'Arconte Supremo (Vazio)',
    visualTrait: 'Entidade cósmica envolta em halo de eclipse violeta, manto dimensional e cetro de singularidade.',
    spriteKey: 'boss_vorath',
    hp: 8600,
    speed: 94,
    damage: 54,
    weight: 11.0,
    xp: 850,
    gold: 320,
    scale: 2.2,
    tint: 0xa855f7,
    resistElement: 'arcane',
    vulnerableElements: ['lightning', 'wind'],
    affinityLabel: 'Resistente a Arcano [-50%] | Vulnerável a Raio/Vento [+50%]'
  },
  {
    id: 'boss_kryos_eternal_winter',
    name: 'Kryos, Dragão do Inverno Eterno',
    roleLabel: 'Arconte Supremo (Gelo)',
    visualTrait: 'Monarca dracônico de cristal safira com asas de nevasca, chifres glaciais e cetro zero absoluto.',
    spriteKey: 'boss_kryos',
    hp: 9800,
    speed: 92,
    damage: 58,
    weight: 12.0,
    xp: 1050,
    gold: 400,
    scale: 2.25,
    tint: 0x38bdf8,
    resistElement: 'ice',
    vulnerableElements: ['fire', 'earth'],
    affinityLabel: 'Resistente a Gelo [-50%] | Vulnerável a Fogo/Terra [+50%]'
  }
];

export const PETS_DATA = [
  {
    id: 'light_fairy',
    name: 'Fada da Luz',
    role: 'Suporte / Escudo',
    spriteKey: 'pet_fairy',
    icon: '🧚',
    color: 0xfef08a,
    cooldown: 5000,
    baseDamage: 50,
    element: 'arcane',
    description: 'Cura o jogador a cada 5s e concede um escudo que, ao quebrar ou expirar, explode causando 10% do dano do jogador + 50 base.'
  },
  {
    id: 'crimson_drake',
    name: 'Dragonete Rubro',
    role: 'AoE Propagador',
    spriteKey: 'pet_drake',
    icon: '🐉',
    color: 0xf97316,
    cooldown: 1400,
    baseDamage: 32,
    element: 'fire',
    description: 'Dispara bolas de fogo nos grupos densos cujas chamas se propagam continuamente entre inimigos próximos.'
  },
  {
    id: 'arcane_owl',
    name: 'Coruja Arcana',
    role: 'Sniper Escalável',
    spriteKey: 'pet_owl',
    icon: '🦉',
    color: 0x38bdf8,
    cooldown: 950,
    baseDamage: 28,
    element: 'ice',
    description: 'Foca no inimigo de maior HP com feixes perfurantes que ganham +2% de dano cumulativo por segundo focado no mesmo alvo.'
  },
  {
    id: 'stone_golem_pet',
    name: 'Golem de Pedra',
    role: 'Guardião Sísmico',
    spriteKey: 'pet_golem',
    icon: '🗿',
    color: 0xd97706,
    cooldown: 1100,
    baseDamage: 35,
    element: 'earth',
    description: 'Orbita o jogador bloqueando projéteis, aplicando Knockback e a cada 5º golpe gera onda sísmica (+50% Dano ao jogador por 5s).'
  },
  {
    id: 'collector_imp',
    name: 'Duende Coletor',
    role: 'Coleta & Veneno',
    spriteKey: 'pet_imp',
    icon: '👺',
    color: 0x84cc16,
    cooldown: 800,
    baseDamage: 20,
    element: 'poison',
    description: 'Corre pelo mapa coletando gemas e itens para o jogador enquanto dispara dardos venenosos nos inimigos próximos.'
  },
  {
    id: 'spirit_wolf',
    name: 'Lobo Espiritual',
    role: 'Matilha de Sylas',
    spriteKey: 'pet_wolf',
    icon: '🐺',
    color: 0x10b981,
    cooldown: 850,
    baseDamage: 30,
    element: 'wind',
    exclusiveTo: 'sylas',
    description: 'Companheiro ancestral de Sylas que dilacera alvos próximos com mordidas espirituais velozes.'
  }
];

export const CHEST_DROP_ITEMS = [
  {
    id: 'global_magnet',
    name: 'Ímã Astral Global',
    icon: '🧲',
    color: '#38bdf8',
    description: 'Atrai em alta velocidade todas as gemas de XP presentes em todo o mapa!'
  },
  {
    id: 'phoenix_heart',
    name: 'Coração de Fênix',
    icon: '❤️',
    color: '#ef4444',
    description: 'Cura 50% do HP máximo e limpa todos os debuffs!'
  },
  {
    id: 'awakening_tome',
    name: 'Tomo do Despertar (XP Jackpot)',
    icon: '📖',
    color: '#fbbf24',
    description: 'Faz o jogador subir instantaneamente +2, +5 ou +10 Níveis de uma vez!'
  },
  {
    id: 'reaper_scythe',
    name: 'Foice do Ceifador',
    icon: '💀',
    color: '#c084fc',
    description: 'Mata instantaneamente 100% dos mobs comuns visíveis e tem 5% de chance de executar Bosses!'
  },
  {
    id: 'chronos_hourglass',
    name: 'Ampulheta Cronos',
    icon: '⏳',
    color: '#34d399',
    description: 'Paralisa todos os inimigos e projéteis inimigos por 6 segundos!'
  },
  {
    id: 'fury_chalice',
    name: 'Cálice da Fúria',
    icon: '🔥',
    color: '#f97316',
    description: 'Dobra a velocidade de conjuração e o tamanho dos projéteis por 10 segundos!'
  }
];
