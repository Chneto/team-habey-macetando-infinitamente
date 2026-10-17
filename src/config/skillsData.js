export const RARITY_TIERS = [
  {
    id: 'common',
    name: 'Comum',
    weight: 84,
    levelJump: 1,
    color: '#cbd5e1',
    borderHex: '#94a3b8',
    badge: 'COMUM (+1 NV)'
  },
  {
    id: 'rare',
    name: 'Rara',
    weight: 10,
    levelJump: 2,
    color: '#38bdf8',
    borderHex: '#0284c7',
    badge: 'RARA (+2 NV)'
  },
  {
    id: 'epic',
    name: 'Épica',
    weight: 5,
    levelJump: 3,
    color: '#c084fc',
    borderHex: '#9333ea',
    badge: 'ÉPICA (+3 NV)'
  },
  {
    id: 'legendary',
    name: 'Lendária',
    weight: 1,
    levelJump: 5,
    color: '#fbbf24',
    borderHex: '#d97706',
    badge: 'LENDÁRIA (NV MÁX!)'
  }
];

export function getXpRequiredForLevel(level) {
  const L = Math.max(1, level);
  return Math.floor(15 * Math.pow(L, 1.28) + L * 10);
}

export function rollCardRarity(luckMultiplier = 1.0, rng = Math.random) {
  const luckBonus = Math.max(0, luckMultiplier - 1.0);
  const legendaryWeight = 1 * (1 + luckBonus * 2.5);
  const epicWeight = 5 * (1 + luckBonus * 1.8);
  const rareWeight = 10 * (1 + luckBonus * 1.4);
  const commonWeight = Math.max(10, 100 - legendaryWeight - epicWeight - rareWeight);

  const total = commonWeight + rareWeight + epicWeight + legendaryWeight;
  let roll = rng() * total;

  if (roll < legendaryWeight) return RARITY_TIERS[3];
  roll -= legendaryWeight;
  if (roll < epicWeight) return RARITY_TIERS[2];
  roll -= epicWeight;
  if (roll < rareWeight) return RARITY_TIERS[1];
  return RARITY_TIERS[0];
}

export const ACTIVE_SKILLS = [
  {
    id: 'rock_barrage',
    name: 'Barragem de Rocha',
    element: 'earth',
    targeting: 'nearest',
    icon: '🪨',
    baseDamage: 26,
    cooldown: 950,
    projectiles: 2,
    speed: 440,
    knockback: 150,
    area: 1.0,
    pierce: 1,
    synergyPassiveId: 'titan_glove',
    fusionPartnerId: 'igneous_bombardment',
    description: 'Arremessa pedregulhos pesados em cadência alternada contra os inimigos mais próximos com alto Knockback.',
    levelBonuses: [
      'Nv.1: 2 pedregulhos sísmicos com alto empurrão.',
      'Nv.2: +1 pedregulho, +25% dano e estilhaços no impacto.',
      'Nv.3: +20% área de impacto e -12% recarga.',
      'Nv.4: +1 pedregulho perfurante e +30% Knockback.',
      'Nv.5: 5 rochas colossais que racham o solo em cone.'
    ]
  },
  {
    id: 'igneous_bombardment',
    name: 'Bombardeio Ígneo',
    element: 'fire',
    targeting: 'dense_cluster',
    icon: '☄️',
    baseDamage: 32,
    cooldown: 1350,
    projectiles: 1,
    speed: 360,
    knockback: 90,
    area: 1.25,
    pierce: 99,
    synergyPassiveId: 'reach_ring',
    fusionPartnerId: 'rock_barrage',
    description: 'Lança esferas de magma que explodem em área (AoE) nos grupos mais densos de inimigos.',
    levelBonuses: [
      'Nv.1: Esfera de magma explosiva no maior grupo.',
      'Nv.2: +25% raio de explosão e +20% dano.',
      'Nv.3: +1 esfera de magma e deixa brasas no chão.',
      'Nv.4: +30% dano de queimadura e -15% recarga.',
      'Nv.5: 3 bombas vulcânicas com ondas de choque duplas.'
    ]
  },
  {
    id: 'ice_lance',
    name: 'Lança de Gelo',
    element: 'ice',
    targeting: 'highest_hp',
    icon: '❄️',
    baseDamage: 34,
    cooldown: 1050,
    projectiles: 1,
    speed: 620,
    knockback: 70,
    area: 1.0,
    pierce: 3,
    synergyPassiveId: 'hawk_eye',
    fusionPartnerId: 'gale_chakram',
    description: 'Dispara estalactites perfurantes de alta velocidade focadas prioritariamente no inimigo de maior HP.',
    levelBonuses: [
      'Nv.1: Estalactite veloz que perfura 3 alvos.',
      'Nv.2: +1 lança glacial e +20% dano crítico.',
      'Nv.3: Perfura +2 inimigos e aplica lentidão intensa.',
      'Nv.4: +1 lança glacial e -15% tempo de recarga.',
      'Nv.5: Rajada de 4 lanças que se dividem em cristais.'
    ]
  },
  {
    id: 'electric_chain',
    name: 'Corrente Elétrica',
    element: 'lightning',
    targeting: 'chain',
    icon: '⚡',
    baseDamage: 22,
    cooldown: 880,
    projectiles: 1,
    speed: 780,
    knockback: 45,
    area: 1.1,
    pierce: 4,
    synergyPassiveId: 'wisdom_tome',
    fusionPartnerId: 'acid_flask',
    description: 'Dispara relâmpagos instantâneos que ricocheteiam entre múltiplos alvos próximos.',
    levelBonuses: [
      'Nv.1: Relâmpago que salta entre 4 inimigos.',
      'Nv.2: +2 saltos elétricos e +20% dano.',
      'Nv.3: +1 feixe inicial e -12% recarga.',
      'Nv.4: +2 saltos e paralisa brevemente no impacto.',
      'Nv.5: Tempestade em cadeia que atinge até 10 alvos.'
    ]
  },
  {
    id: 'thorn_swarm',
    name: 'Enxame de Espinhos',
    element: 'poison',
    targeting: 'frontal_cone',
    icon: '🌿',
    baseDamage: 16,
    cooldown: 780,
    projectiles: 4,
    speed: 500,
    knockback: 55,
    area: 1.0,
    pierce: 2,
    synergyPassiveId: 'duplicator_crystal',
    fusionPartnerId: 'spirit_totem',
    description: 'Dispara rajadas rápidas de espinhos tóxicos em cone na direção do movimento ou do inimigo mais próximo.',
    levelBonuses: [
      'Nv.1: 4 espinhos venenosos em leque frontal.',
      'Nv.2: +2 espinhos e +20% dano de veneno.',
      'Nv.3: Espinhos perfuram +1 alvo e corroem armadura.',
      'Nv.4: +2 espinhos e -15% recarga.',
      'Nv.5: Leque de 10 espinhos que germinam esporos tóxicos.'
    ]
  },
  {
    id: 'gale_chakram',
    name: 'Chakram de Vendaval',
    element: 'wind',
    targeting: 'boomerang',
    icon: '🌪️',
    baseDamage: 24,
    cooldown: 1100,
    projectiles: 1,
    speed: 460,
    knockback: 80,
    area: 1.15,
    pierce: 99,
    synergyPassiveId: 'hermes_boots',
    fusionPartnerId: 'ice_lance',
    description: 'Arremessa discos cortantes em trajetória bumerangue elíptica que atravessam a horda e puxam inimigos leves.',
    levelBonuses: [
      'Nv.1: Disco eólico bumerangue que atravessa tudo.',
      'Nv.2: +1 Chakram e +20% tamanho do disco.',
      'Nv.3: Puxa inimigos leves no retorno e +25% dano.',
      'Nv.4: +1 Chakram e maior velocidade orbital.',
      'Nv.5: 4 Chakrams gigantes com vórtice cortante.'
    ]
  },
  {
    id: 'abyssal_orb',
    name: 'Orbe Abissal',
    element: 'arcane',
    targeting: 'vortex',
    icon: '🔮',
    baseDamage: 30,
    cooldown: 1450,
    projectiles: 1,
    speed: 260,
    knockback: -120,
    area: 1.3,
    pierce: 99,
    synergyPassiveId: 'astral_magnet',
    fusionPartnerId: 'temporal_needle',
    description: 'Dispara vórtices gravitacionais que puxam inimigos próximos para o centro antes de implodir.',
    levelBonuses: [
      'Nv.1: Vórtice gravitacional com implosão arcana.',
      'Nv.2: +25% raio de atração e +20% dano.',
      'Nv.3: +1 Orbe Abissal e maior duração.',
      'Nv.4: Implosão dupla e -15% recarga.',
      'Nv.5: Buracos negros gêmeos que distorcem a arena.'
    ]
  },
  {
    id: 'solar_hammer',
    name: 'Martelo Solar Orbital',
    element: 'fire',
    targeting: 'orbital',
    icon: '🔨',
    baseDamage: 25,
    cooldown: 1200,
    projectiles: 2,
    speed: 380,
    knockback: 140,
    area: 1.15,
    pierce: 99,
    synergyPassiveId: 'dragon_heart',
    fusionPartnerId: 'meteor_rain',
    description: 'Martelos flamejantes giram permanentemente ao redor do personagem, aplicando alto dano e repelindo inimigos.',
    levelBonuses: [
      'Nv.1: 2 martelos solares orbitais contínuos.',
      'Nv.2: +1 martelo orbital e +20% velocidade de giro.',
      'Nv.3: +25% tamanho e empurrão flamejante.',
      'Nv.4: +1 martelo orbital e ondas de calor.',
      'Nv.5: 6 martelos radiantes com aura incineradora.'
    ]
  },
  {
    id: 'acid_flask',
    name: 'Frasco Ácido',
    element: 'poison',
    targeting: 'lob_pool',
    icon: '🧪',
    baseDamage: 20,
    cooldown: 1300,
    projectiles: 1,
    speed: 350,
    knockback: 30,
    area: 1.3,
    pierce: 99,
    synergyPassiveId: 'eternal_hourglass',
    fusionPartnerId: 'electric_chain',
    description: 'Arremessa frascos em arco que quebram no chão, criando poças ácidas que derretem a armadura dos inimigos.',
    levelBonuses: [
      'Nv.1: Poça corrosiva que derrete 20% da armadura.',
      'Nv.2: +1 frasco ácido e +25% raio da poça.',
      'Nv.3: +1.5s de duração da poça e +25% dano.',
      'Nv.4: +1 frasco ácido e bolhas explosivas.',
      'Nv.5: 4 frascos bioquímicos que interligam poças tóxicas.'
    ]
  },
  {
    id: 'temporal_needle',
    name: 'Agulha Temporal',
    element: 'arcane',
    targeting: 'line_pierce',
    icon: '⏳',
    baseDamage: 28,
    cooldown: 920,
    projectiles: 1,
    speed: 820,
    knockback: 60,
    area: 1.0,
    pierce: 99,
    synergyPassiveId: 'kinetic_accelerator',
    fusionPartnerId: 'abyssal_orb',
    description: 'Dispara feixes cronológicos instantâneos que perfuram todos os inimigos em linha reta e reduzem a velocidade em 35%.',
    levelBonuses: [
      'Nv.1: Feixe temporal perfurante com 35% lentidão.',
      'Nv.2: +1 feixe cronológico e +20% dano.',
      'Nv.3: Feixes deixam eco temporal que explode após 0.5s.',
      'Nv.4: +1 feixe e -15% recarga.',
      'Nv.5: 4 lanças paradoxais que congelam o fluxo do tempo.'
    ]
  },
  {
    id: 'meteor_rain',
    name: 'Chuva de Meteoros',
    element: 'fire',
    targeting: 'sky_strike',
    icon: '🌠',
    baseDamage: 42,
    cooldown: 1600,
    projectiles: 2,
    speed: 520,
    knockback: 110,
    area: 1.35,
    pierce: 99,
    synergyPassiveId: 'crown_of_greed',
    fusionPartnerId: 'solar_hammer',
    description: 'Invoca meteoros colossais do cosmos que caem em diagonal esmagando hordas e deixando solo ardente.',
    levelBonuses: [
      'Nv.1: 2 meteoros astrais caem sobre inimigos próximos.',
      'Nv.2: +1 meteoro e +25% área de cratera.',
      'Nv.3: +30% dano de impacto e fragmentos ígneos.',
      'Nv.4: +1 meteoro e -15% recarga.',
      'Nv.5: Bombardeio de 6 meteoros dourados em sequência.'
    ]
  },
  {
    id: 'spirit_totem',
    name: 'Totem Espiritual',
    element: 'earth',
    targeting: 'totem_zone',
    icon: '🗿',
    baseDamage: 27,
    cooldown: 1500,
    projectiles: 1,
    speed: 0,
    knockback: 130,
    area: 1.3,
    pierce: 99,
    synergyPassiveId: 'thorn_armor',
    fusionPartnerId: 'thorn_swarm',
    description: 'Evoca totens ancestrais no campo que pulsam ondas sísmicas periódicas contra inimigos ao redor.',
    levelBonuses: [
      'Nv.1: Totem rúnico que pulsa 3 ondas sísmicas.',
      'Nv.2: +25% raio de pulso e +20% dano.',
      'Nv.3: +1 Totem simultâneo e atordoamento leve.',
      'Nv.4: +2 pulsos por totem e -15% recarga.',
      'Nv.5: Santuário de 3 totens ancestrais interconectados.'
    ]
  }
];

export const PASSIVE_SKILLS = [
  {
    id: 'titan_glove',
    name: 'Luva de Titã',
    category: 'core',
    icon: '🥊',
    statKey: 'damageMult',
    bonusPerLevel: 0.12,
    synergyActiveId: 'rock_barrage',
    description: 'Aumenta o Dano Global de todas as habilidades e ataques em +12% por nível.'
  },
  {
    id: 'reach_ring',
    name: 'Anel de Alcance',
    category: 'core',
    icon: '💍',
    statKey: 'areaMult',
    bonusPerLevel: 0.12,
    synergyActiveId: 'igneous_bombardment',
    description: 'Expande o Raio e Área de Efeito de todas as explosões e armas em +12% por nível.'
  },
  {
    id: 'hawk_eye',
    name: 'Olho de Falcão',
    category: 'core',
    icon: '🦅',
    statKey: 'critChance',
    bonusPerLevel: 0.07,
    synergyActiveId: 'ice_lance',
    description: 'Concede +7% de Chance Crítica e +15% de Multiplicador Crítico por nível.'
  },
  {
    id: 'wisdom_tome',
    name: 'Tomo de Sabedoria',
    category: 'core',
    icon: '📘',
    statKey: 'cooldownReduction',
    bonusPerLevel: 0.08,
    synergyActiveId: 'electric_chain',
    description: 'Reduz o Tempo de Recarga de todas as habilidades ativas em 8% por nível.'
  },
  {
    id: 'duplicator_crystal',
    name: 'Cristal Duplicador',
    category: 'core',
    icon: '💎',
    statKey: 'extraProjectiles',
    bonusPerLevel: 1,
    synergyActiveId: 'thorn_swarm',
    description: 'Adiciona +1 Projétil extra nos níveis ímpares e +12% Dano de Projétil nos níveis pares.'
  },
  {
    id: 'hermes_boots',
    name: 'Botas de Hermes',
    category: 'core',
    icon: '🥾',
    statKey: 'moveSpeedMult',
    bonusPerLevel: 0.09,
    synergyActiveId: 'gale_chakram',
    description: 'Aumenta a Velocidade de Movimento em +9% e acelera recarga do Dash por nível.'
  },
  {
    id: 'astral_magnet',
    name: 'Ímã Astral',
    category: 'core',
    icon: '🧲',
    statKey: 'pickupRadiusMult',
    bonusPerLevel: 0.25,
    synergyActiveId: 'abyssal_orb',
    description: 'Amplia o Raio de Coleta magnética de gemas e ouro em +25% por nível.'
  },
  {
    id: 'dragon_heart',
    name: 'Coração de Dragão',
    category: 'core',
    icon: '❤️',
    statKey: 'maxHpBonus',
    bonusPerLevel: 22,
    synergyActiveId: 'solar_hammer',
    description: 'Aumenta o HP Máximo em +22 e a Regeneração de Vida em +1.2 HP/s por nível.'
  },
  {
    id: 'eternal_hourglass',
    name: 'Ampulheta Eterna',
    category: 'core',
    icon: '⌛',
    statKey: 'durationMult',
    bonusPerLevel: 0.15,
    synergyActiveId: 'acid_flask',
    description: 'Aumenta a Duração de poças, órbitas, totens e status elementais em +15% por nível.'
  },
  {
    id: 'kinetic_accelerator',
    name: 'Acelerador Cinético',
    category: 'core',
    icon: '🚀',
    statKey: 'projectileSpeedMult',
    bonusPerLevel: 0.15,
    synergyActiveId: 'temporal_needle',
    description: 'Aumenta a Velocidade de Projéteis em +15% e a força de Knockback em +10% por nível.'
  },
  {
    id: 'crown_of_greed',
    name: 'Coroa da Ganância',
    category: 'relic',
    icon: '👑',
    statKey: 'xpGoldMult',
    bonusPerLevel: 0.14,
    synergyActiveId: 'meteor_rain',
    description: 'Aumenta o ganho de XP e Ouro Elemental em +14% e Sorte em +5% por nível.'
  },
  {
    id: 'thorn_armor',
    name: 'Armadura de Espinhos',
    category: 'relic',
    icon: '🛡️',
    statKey: 'armorBonus',
    bonusPerLevel: 0.06,
    synergyActiveId: 'spirit_totem',
    description: 'Reduz o dano recebido em +6% por nível e reflete dano sísmico aos atacantes.'
  }
];

export const SYNERGY_EVOLUTIONS = [
  {
    id: 'evo_four_fists_cataclysm',
    name: 'Cataclismo dos Quatro Punhos (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'rock_barrage',
    passiveId: 'titan_glove',
    element: 'earth',
    targeting: 'nearest',
    icon: '🌋',
    baseDamage: 78,
    cooldown: 620,
    projectiles: 6,
    speed: 560,
    knockback: 260,
    area: 1.65,
    pierce: 4,
    freesSlot: 'passive',
    description: 'Dispara monólitos tectônicos colossais que fraturam o solo e atordoam hordas inteiras. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_inner_blazing_sun',
    name: 'Sol Interior em Chamas (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'igneous_bombardment',
    passiveId: 'reach_ring',
    element: 'fire',
    targeting: 'dense_cluster',
    icon: '☀️',
    baseDamage: 92,
    cooldown: 880,
    projectiles: 4,
    speed: 440,
    knockback: 150,
    area: 2.1,
    pierce: 99,
    freesSlot: 'passive',
    description: 'Detona supernovas de magma encadeadas nos grupos mais densos, incendiando toda a tela. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_absolute_zero_icicle',
    name: 'Estalactite do Zero Absoluto (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'ice_lance',
    passiveId: 'hawk_eye',
    element: 'ice',
    targeting: 'highest_hp',
    icon: '🧊',
    baseDamage: 96,
    cooldown: 680,
    projectiles: 5,
    speed: 780,
    knockback: 110,
    area: 1.5,
    pierce: 8,
    freesSlot: 'passive',
    description: 'Lanças glaciais críticas garantidas que explodem em rosas de cristal congelante. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_infinite_thor_storm',
    name: 'Tempestade de Thor Infinita (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'electric_chain',
    passiveId: 'wisdom_tome',
    element: 'lightning',
    targeting: 'chain',
    icon: '🌩️',
    baseDamage: 66,
    cooldown: 480,
    projectiles: 3,
    speed: 920,
    knockback: 85,
    area: 1.75,
    pierce: 12,
    freesSlot: 'passive',
    description: 'Relâmpagos divinos incessantes que ricocheteiam por 12 alvos e chamam trovões do céu. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_carnivorous_forest',
    name: 'Floresta Carnívora (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'thorn_swarm',
    passiveId: 'duplicator_crystal',
    element: 'poison',
    targeting: 'frontal_cone',
    icon: '🌺',
    baseDamage: 48,
    cooldown: 520,
    projectiles: 12,
    speed: 620,
    knockback: 90,
    area: 1.5,
    pierce: 5,
    freesSlot: 'passive',
    description: 'Dispara 12 vinhas espinhosas vorazes que enraízam e drenam a vida dos inimigos. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_blade_cyclone',
    name: 'Ciclone de Lâminas (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'gale_chakram',
    passiveId: 'hermes_boots',
    element: 'wind',
    targeting: 'boomerang',
    icon: '🌀',
    baseDamage: 72,
    cooldown: 700,
    projectiles: 5,
    speed: 600,
    knockback: 130,
    area: 1.75,
    pierce: 99,
    freesSlot: 'passive',
    description: 'Furacões de lâminas esmeraldas que orbitam e rasgam toda a arena continuamente. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_event_horizon',
    name: 'Horizonte de Eventos (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'abyssal_orb',
    passiveId: 'astral_magnet',
    element: 'arcane',
    targeting: 'vortex',
    icon: '🕳️',
    baseDamage: 90,
    cooldown: 950,
    projectiles: 3,
    speed: 320,
    knockback: -220,
    area: 2.0,
    pierce: 99,
    freesSlot: 'passive',
    description: 'Singularidades abissais que sugam inimigos e gemas de XP antes de colapsar em dano massivo. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_sun_god_judgment',
    name: 'Julgamento do Deus Sol (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'solar_hammer',
    passiveId: 'dragon_heart',
    element: 'fire',
    targeting: 'orbital',
    icon: '⚜️',
    baseDamage: 74,
    cooldown: 760,
    projectiles: 6,
    speed: 520,
    knockback: 210,
    area: 1.85,
    pierce: 99,
    freesSlot: 'passive',
    description: 'Anel duplo de martelos sagrados que incineram inimigos e pulsam cura solar. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_biochemical_deluge',
    name: 'Dilúvio Bioquímico (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'acid_flask',
    passiveId: 'eternal_hourglass',
    element: 'poison',
    targeting: 'lob_pool',
    icon: '☣️',
    baseDamage: 64,
    cooldown: 840,
    projectiles: 5,
    speed: 440,
    knockback: 60,
    area: 2.0,
    pierce: 99,
    freesSlot: 'passive',
    description: 'Inunda o mapa com mares de ácido fervente que dissolvem armaduras instantaneamente. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_spacetime_collapse',
    name: 'Colapso do Espaço-Tempo (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'temporal_needle',
    passiveId: 'kinetic_accelerator',
    element: 'arcane',
    targeting: 'line_pierce',
    icon: '🌌',
    baseDamage: 84,
    cooldown: 580,
    projectiles: 5,
    speed: 1050,
    knockback: 110,
    area: 1.6,
    pierce: 99,
    freesSlot: 'passive',
    description: 'Feixes taquiônicos que rasgam dimensões, paralisando inimigos e ecoando dano triplo. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_golden_stellar_apocalypse',
    name: 'Apocalipse Estelar Dourado (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'meteor_rain',
    passiveId: 'crown_of_greed',
    element: 'fire',
    targeting: 'sky_strike',
    icon: '🌟',
    baseDamage: 118,
    cooldown: 1000,
    projectiles: 6,
    speed: 660,
    knockback: 180,
    area: 2.0,
    pierce: 99,
    freesSlot: 'passive',
    description: 'Chuva de cometas dourados que dizima hordas e converte inimigos abatidos em ouro. Libera 1 Slot Passivo!'
  },
  {
    id: 'evo_ancestors_avatar',
    name: 'Avatar dos Ancestrais (★)',
    type: 'evolution',
    stars: 1,
    activeId: 'spirit_totem',
    passiveId: 'thorn_armor',
    element: 'earth',
    targeting: 'totem_zone',
    icon: '🏛️',
    baseDamage: 82,
    cooldown: 940,
    projectiles: 3,
    speed: 0,
    knockback: 220,
    area: 2.0,
    pierce: 99,
    freesSlot: 'passive',
    description: 'Monólitos ancestrais que invocam terremotos rúnicos contínuos em toda a arena. Libera 1 Slot Passivo!'
  }
];

export const DUAL_FUSIONS = [
  {
    id: 'fusion_volcanic_tectonic_titan',
    name: 'Titã da Tectônica Vulcânica (★★)',
    type: 'fusion',
    stars: 2,
    activeAId: 'rock_barrage',
    activeBId: 'igneous_bombardment',
    element: 'earth',
    secondaryElement: 'fire',
    targeting: 'dense_cluster',
    icon: '🌋',
    baseDamage: 145,
    cooldown: 640,
    projectiles: 6,
    speed: 540,
    knockback: 280,
    area: 2.3,
    pierce: 99,
    freesSlot: 'active',
    description: 'Fusão Suprema (Terra+Fogo): Dispara meteoros tectônicos que acionam Erupção de Magma automática no impacto! Libera 1 Slot Ativo!'
  },
  {
    id: 'fusion_nine_winds_blizzard',
    name: 'Nevasca Cortante dos Nove Ventos (★★)',
    type: 'fusion',
    stars: 2,
    activeAId: 'ice_lance',
    activeBId: 'gale_chakram',
    element: 'ice',
    secondaryElement: 'wind',
    targeting: 'boomerang',
    icon: '❄️',
    baseDamage: 138,
    cooldown: 580,
    projectiles: 6,
    speed: 720,
    knockback: 160,
    area: 2.2,
    pierce: 99,
    freesSlot: 'active',
    description: 'Fusão Suprema (Gelo+Vento): Turbilhões de lâminas criogênicas que puxam, congelam e estilhaçam tudo! Libera 1 Slot Ativo!'
  },
  {
    id: 'fusion_corrosive_plasma_cloud',
    name: 'Nuvem de Plasma Corrosivo (★★)',
    type: 'fusion',
    stars: 2,
    activeAId: 'electric_chain',
    activeBId: 'acid_flask',
    element: 'lightning',
    secondaryElement: 'poison',
    targeting: 'chain',
    icon: '⛈️',
    baseDamage: 132,
    cooldown: 540,
    projectiles: 5,
    speed: 820,
    knockback: 110,
    area: 2.25,
    pierce: 14,
    freesSlot: 'active',
    description: 'Fusão Suprema (Raio+Veneno): Tempestades bioelétricas que derretem armaduras e saltam entre 14 alvos! Libera 1 Slot Ativo!'
  },
  {
    id: 'fusion_paradox_singularity',
    name: 'Singularidade Paradoxal (★★)',
    type: 'fusion',
    stars: 2,
    activeAId: 'abyssal_orb',
    activeBId: 'temporal_needle',
    element: 'arcane',
    secondaryElement: 'arcane',
    targeting: 'vortex',
    icon: '🕳️',
    baseDamage: 155,
    cooldown: 680,
    projectiles: 4,
    speed: 650,
    knockback: -260,
    area: 2.4,
    pierce: 99,
    freesSlot: 'active',
    description: 'Fusão Suprema (Arcano+Tempo): Buracos negros temporais que congelam inimigos e detonam raios dimensionais! Libera 1 Slot Ativo!'
  },
  {
    id: 'fusion_primordial_gaia_wrath',
    name: 'Fúria de Gaia Primordial (★★)',
    type: 'fusion',
    stars: 2,
    activeAId: 'thorn_swarm',
    activeBId: 'spirit_totem',
    element: 'poison',
    secondaryElement: 'earth',
    targeting: 'frontal_cone',
    icon: '🌳',
    baseDamage: 136,
    cooldown: 560,
    projectiles: 10,
    speed: 600,
    knockback: 200,
    area: 2.2,
    pierce: 99,
    freesSlot: 'active',
    description: 'Fusão Suprema (Veneno+Terra): Totens vivos que disparam enxames de raízes sísmicas venenosas em 360 graus! Libera 1 Slot Ativo!'
  },
  {
    id: 'fusion_solar_firmament_wrath',
    name: 'Ira do Firmamento Solar (★★)',
    type: 'fusion',
    stars: 2,
    activeAId: 'solar_hammer',
    activeBId: 'meteor_rain',
    element: 'fire',
    secondaryElement: 'fire',
    targeting: 'orbital',
    icon: '🌞',
    baseDamage: 165,
    cooldown: 660,
    projectiles: 8,
    speed: 580,
    knockback: 240,
    area: 2.5,
    pierce: 99,
    freesSlot: 'active',
    description: 'Fusão Suprema (Sol+Meteoros): Martelos estelares em órbita que invocam tempestades apocalípticas de astros! Libera 1 Slot Ativo!'
  }
];

export const LIMIT_BREAK_OPTIONS = [
  {
    id: 'lb_damage',
    name: 'Limit Break: Poder Brutal',
    icon: '🔥',
    stat: 'damageMult',
    amount: 0.05,
    description: 'Aumenta permanentemente o Dano Global desta partida em +5%.'
  },
  {
    id: 'lb_area',
    name: 'Limit Break: Expansão Astral',
    icon: '🌌',
    stat: 'areaMult',
    amount: 0.05,
    description: 'Aumenta permanentemente a Área de Efeito desta partida em +5%.'
  },
  {
    id: 'lb_cooldown',
    name: 'Limit Break: Pulso Taquiônico',
    icon: '⚡',
    stat: 'cooldownReduction',
    amount: 0.03,
    description: 'Reduz permanentemente o Tempo de Recarga desta partida em -3%.'
  }
];

export function getSkillById(id) {
  return (
    ACTIVE_SKILLS.find((s) => s.id === id) ||
    PASSIVE_SKILLS.find((s) => s.id === id) ||
    SYNERGY_EVOLUTIONS.find((s) => s.id === id) ||
    DUAL_FUSIONS.find((s) => s.id === id) ||
    null
  );
}
