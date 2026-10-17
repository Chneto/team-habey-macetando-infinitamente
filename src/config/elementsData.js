export const ELEMENTS = {
  earth: {
    id: 'earth',
    name: 'Terra',
    color: 0xd97706,
    hex: '#d97706',
    particleColor: 0xf59e0b,
    duration: 4000,
    icon: '🪨',
    description: 'Pesado e sísmico. Reduz estabilidade inimiga e amplifica empurrão.'
  },
  fire: {
    id: 'fire',
    name: 'Fogo',
    color: 0xf97316,
    hex: '#f97316',
    particleColor: 0xef4444,
    duration: 4000,
    icon: '🔥',
    description: 'Incendeia o alvo causando dano contínuo (DoT) a cada 0.5s por 4s.'
  },
  ice: {
    id: 'ice',
    name: 'Gelo',
    color: 0x38bdf8,
    hex: '#38bdf8',
    particleColor: 0x7dd3fc,
    duration: 4000,
    icon: '❄️',
    description: 'Congela parcialmente o alvo, reduzindo sua velocidade de movimento em 30%.'
  },
  lightning: {
    id: 'lightning',
    name: 'Raio',
    color: 0xfacc15,
    hex: '#facc15',
    particleColor: 0xfef08a,
    duration: 4000,
    icon: '⚡',
    description: 'Eletrocuta o alvo com espasmos que interrompem ataques e saltam entre vizinhos.'
  },
  wind: {
    id: 'wind',
    name: 'Vento',
    color: 0x10b981,
    hex: '#10b981',
    particleColor: 0x34d399,
    duration: 4000,
    icon: '🌪️',
    description: 'Correntes cortantes que desestabilizam inimigos leves e propagam outros elementos.'
  },
  poison: {
    id: 'poison',
    name: 'Veneno',
    color: 0x84cc16,
    hex: '#84cc16',
    particleColor: 0xa3e635,
    duration: 4000,
    icon: '🧪',
    description: 'Toxina corrosiva acumulativa que reduz a armadura inimiga em 20% e causa DoT.'
  },
  arcane: {
    id: 'arcane',
    name: 'Arcano',
    color: 0xa855f7,
    hex: '#a855f7',
    particleColor: 0xc084fc,
    duration: 4000,
    icon: '🔮',
    description: 'Energia gravitacional do vazio que distorce o espaço-tempo e amplifica reações.'
  }
};

export const ELEMENTAL_REACTIONS = [
  {
    id: 'magma_eruption',
    name: 'Erupção de Magma',
    elements: ['earth', 'fire'],
    color: 0xff5722,
    hex: '#ff5722',
    damageMult: 1.85,
    radius: 110,
    duration: 3000,
    slowPct: 0.40,
    description: 'Cria uma fissura vulcânica no chão por 3s causando dano contínuo em área e lentidão de 40%.'
  },
  {
    id: 'rock_shatter',
    name: 'Estilhaçar Rochoso (Shatter)',
    elements: ['earth', 'ice'],
    color: 0x67e8f9,
    hex: '#67e8f9',
    damageMult: 2.20,
    guaranteedCrit: true,
    knockbackMult: 2.0,
    radius: 95,
    description: 'Causa dano físico/elemental crítico garantido (2.2x) e onda de choque com Knockback duplo.'
  },
  {
    id: 'thermal_shock',
    name: 'Choque Térmico',
    elements: ['fire', 'ice'],
    color: 0xe0f2fe,
    hex: '#e0f2fe',
    damageMult: 2.50,
    armorShred: 0.30,
    radius: 105,
    description: 'Explosão de vapor que causa 250% de dano imediato e reduz a defesa do inimigo em 30%.'
  },
  {
    id: 'toxic_combustion',
    name: 'Combustão Tóxica',
    elements: ['fire', 'poison'],
    color: 0xa3e635,
    hex: '#a3e635',
    damageMult: 2.10,
    spreadElement: 'poison',
    radius: 120,
    description: 'Detona as cargas de veneno em uma explosão violenta que espalha chamas ácidas aos inimigos adjacentes.'
  },
  {
    id: 'superconductor',
    name: 'Supercondutor',
    elements: ['ice', 'lightning'],
    color: 0xfef08a,
    hex: '#fef08a',
    damageMult: 1.75,
    chainTargets: 8,
    cooldownReductionMs: 500,
    radius: 160,
    description: 'Dispara arcos elétricos para até 8 inimigos próximos e reduz em 0.5s os cooldowns ativos do jogador.'
  },
  {
    id: 'elemental_whirlwind',
    name: 'Turbilhão Elemental',
    elements: ['wind', '*'],
    color: 0x34d399,
    hex: '#34d399',
    damageMult: 1.65,
    pullStrength: 180,
    radiusBonusPct: 0.50,
    radius: 135,
    description: 'Cria um ciclone que puxa inimigos leves para o centro e aumenta o raio do elemento combinado em +50%.'
  },
  {
    id: 'dimensional_rupture',
    name: 'Ruptura Dimensional',
    elements: ['arcane', '*'],
    color: 0xc084fc,
    hex: '#c084fc',
    damageMult: 2.00,
    vulnerabilityBonusPct: 0.25,
    radius: 100,
    description: 'Duplica o dano do status elemental atual e aplica vulnerabilidade arcana (+25% de dano recebido).'
  }
];

export function resolveElementalReaction(firstElem, secondElem) {
  if (!firstElem || !secondElem || (firstElem === secondElem && firstElem !== 'arcane')) return null;
  const pair = [firstElem, secondElem].sort();

  for (const reaction of ELEMENTAL_REACTIONS) {
    if (!reaction.elements.includes('*')) {
      const rPair = [...reaction.elements].sort();
      if (pair[0] === rPair[0] && pair[1] === rPair[1]) {
        return { ...reaction, combinedWith: secondElem };
      }
    }
  }

  if (firstElem === 'wind' || secondElem === 'wind') {
    const other = firstElem === 'wind' ? secondElem : firstElem;
    const base = ELEMENTAL_REACTIONS.find((r) => r.id === 'elemental_whirlwind');
    return { ...base, combinedWith: other };
  }

  if (firstElem === 'arcane' || secondElem === 'arcane') {
    const other = firstElem === 'arcane' ? secondElem : firstElem;
    const base = ELEMENTAL_REACTIONS.find((r) => r.id === 'dimensional_rupture');
    return { ...base, combinedWith: other };
  }

  return null;
}
