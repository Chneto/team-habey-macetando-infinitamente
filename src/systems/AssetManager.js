import { CHARACTERS_DATA } from '../config/charactersData.js';
import { ENEMY_TYPES, MINI_BOSS_TEMPLATES, MAIN_BOSS_TEMPLATES, PETS_DATA } from '../config/enemiesData.js';

export class AssetManager {
  static preload(scene) {
    // Suppress default file missing crash; fallback generator handles any failed file seamlessly
    scene.load.on('loaderror', () => {});

    for (const char of CHARACTERS_DATA) {
      scene.load.spritesheet(char.spriteKey, `assets/sprites/${char.spriteKey}.png`, {
        frameWidth: 64,
        frameHeight: 64
      });
    }

    scene.load.image('petrus_rock_arm', 'assets/sprites/petrus_rock_arm.png');

    for (const pet of PETS_DATA) {
      scene.load.spritesheet(pet.spriteKey, `assets/sprites/${pet.spriteKey}.png`, {
        frameWidth: 48,
        frameHeight: 48
      });
    }

    for (const enemy of ENEMY_TYPES) {
      scene.load.spritesheet(enemy.spriteKey, `assets/sprites/${enemy.spriteKey}.png`, {
        frameWidth: 64,
        frameHeight: 64
      });
    }

    const bossKeys = new Set([
      'boss_archon',
      ...MINI_BOSS_TEMPLATES.map((b) => b.spriteKey).filter(Boolean),
      ...MAIN_BOSS_TEMPLATES.map((b) => b.spriteKey).filter(Boolean)
    ]);
    for (const bossKey of bossKeys) {
      scene.load.spritesheet(bossKey, `assets/sprites/${bossKey}.png`, {
        frameWidth: 96,
        frameHeight: 96
      });
    }

    scene.load.image('treasure_chest', 'assets/sprites/treasure_chest.png');
    scene.load.image('pet_cage', 'assets/sprites/pet_cage.png');
    scene.load.image('arcane_floor', 'assets/sprites/arcane_floor.png');
  }

  static ensureAllAssets(scene) {
    for (const char of CHARACTERS_DATA) {
      this.ensureFourFrameSheet(scene, char.spriteKey, 64, 64, char.primaryColor, char.accentColor);
    }

    for (const pet of PETS_DATA) {
      this.ensureFourFrameSheet(scene, pet.spriteKey, 48, 48, pet.color, 0xffffff);
    }

    for (const enemy of ENEMY_TYPES) {
      this.ensureFourFrameSheet(scene, enemy.spriteKey, 64, 64, enemy.color, 0xef4444);
    }

    this.ensureFourFrameSheet(scene, 'boss_archon', 96, 96, 0x4c1d95, 0xf97316);
    for (const mb of MINI_BOSS_TEMPLATES) {
      if (mb.spriteKey) {
        this.ensureFourFrameSheet(scene, mb.spriteKey, 96, 96, mb.tint || 0x4c1d95, 0xfbbf24);
      }
    }
    for (const b of MAIN_BOSS_TEMPLATES) {
      if (b.spriteKey) {
        this.ensureFourFrameSheet(scene, b.spriteKey, 96, 96, b.tint || 0x991b1b, 0xfef08a);
      }
    }

    this.ensureSingleTexture(scene, 'petrus_rock_arm', 32, 32, (ctx) => {
      ctx.clearRect(0, 0, 32, 32);
      ctx.fillStyle = '#78716c';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(16, 16, 11, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Gold knuckle brace & amber magma vein
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(17, 9, 3, 14);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(20, 16, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    this.ensureSingleTexture(scene, 'treasure_chest', 48, 48, (ctx) => {
      ctx.clearRect(0, 0, 48, 48);
      ctx.fillStyle = '#92400e';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.fillRect(8, 14, 32, 24);
      ctx.strokeRect(8, 14, 32, 24);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(21, 22, 6, 8);
    });

    this.ensureSingleTexture(scene, 'pet_cage', 48, 48, (ctx) => {
      ctx.clearRect(0, 0, 48, 48);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(24, 24, 18, 0, Math.PI * 2);
      ctx.stroke();
      for (let x = 14; x <= 34; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, 9);
        ctx.lineTo(x, 39);
        ctx.stroke();
      }
    });

    this.ensureSingleTexture(scene, 'arcane_floor', 128, 128, (ctx) => {
      ctx.fillStyle = '#141622';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#23273a';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, 60, 60);
      ctx.strokeRect(66, 2, 60, 60);
      ctx.strokeRect(2, 66, 60, 60);
      ctx.strokeRect(66, 66, 60, 60);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.45)';
      ctx.beginPath();
      ctx.arc(64, 64, 20, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Procedural Combat & Pickup Textures
    this.ensureSingleTexture(scene, 'xp_gem', 20, 20, (ctx) => {
      ctx.clearRect(0, 0, 20, 20);
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(10, 2);
      ctx.lineTo(17, 10);
      ctx.lineTo(10, 18);
      ctx.lineTo(3, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    this.ensureSingleTexture(scene, 'super_xp_gem', 28, 28, (ctx) => {
      ctx.clearRect(0, 0, 28, 28);
      ctx.fillStyle = '#f43f5e';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 2);
      ctx.lineTo(25, 14);
      ctx.lineTo(14, 26);
      ctx.lineTo(3, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    this.ensureSingleTexture(scene, 'projectile_orb', 24, 24, (ctx) => {
      ctx.clearRect(0, 0, 24, 24);
      const grad = ctx.createRadialGradient(12, 12, 2, 12, 12, 11);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#cbd5e1');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(12, 12, 11, 0, Math.PI * 2);
      ctx.fill();
    });

    // Bespoke Weapon Projectile Textures
    // 1. Petrus Rock / Boulder (jagged octagonal stone with glowing amber core)
    this.ensureSingleTexture(scene, 'proj_rock', 28, 28, (ctx) => {
      ctx.clearRect(0, 0, 28, 28);
      ctx.fillStyle = '#78716c';
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 2);
      ctx.lineTo(23, 6);
      ctx.lineTo(26, 14);
      ctx.lineTo(22, 23);
      ctx.lineTo(13, 26);
      ctx.lineTo(5, 22);
      ctx.lineTo(2, 13);
      ctx.lineTo(6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(14, 9);
      ctx.lineTo(19, 14);
      ctx.lineTo(14, 19);
      ctx.lineTo(9, 14);
      ctx.closePath();
      ctx.fill();
    });

    // 2. Ignis Fireball (blazing directional comet pointing right -> 0 rad)
    this.ensureSingleTexture(scene, 'proj_fireball', 32, 22, (ctx) => {
      ctx.clearRect(0, 0, 32, 22);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(2, 11);
      ctx.lineTo(14, 3);
      ctx.lineTo(28, 11);
      ctx.lineTo(14, 19);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(20, 11, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(22, 11, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Crya Ice Lance (crystalline diamond spearhead pointing right -> 0 rad)
    this.ensureSingleTexture(scene, 'proj_icelance', 34, 16, (ctx) => {
      ctx.clearRect(0, 0, 34, 16);
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0c4a6e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(2, 8);
      ctx.lineTo(12, 3);
      ctx.lineTo(32, 8);
      ctx.lineTo(12, 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(8, 8);
      ctx.lineTo(15, 5);
      ctx.lineTo(28, 8);
      ctx.lineTo(15, 11);
      ctx.closePath();
      ctx.fill();
    });

    // 4. Sylas Poison Thorn (barbed emerald bramble spike pointing right -> 0 rad)
    this.ensureSingleTexture(scene, 'proj_thorn', 28, 16, (ctx) => {
      ctx.clearRect(0, 0, 28, 16);
      ctx.fillStyle = '#16a34a';
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(2, 8);
      ctx.lineTo(10, 2);
      ctx.lineTo(10, 5);
      ctx.lineTo(26, 8);
      ctx.lineTo(10, 11);
      ctx.lineTo(10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.moveTo(10, 8);
      ctx.lineTo(22, 8);
      ctx.strokeStyle = '#bbf7d0';
      ctx.stroke();
    });

    // 5. Zephyr Wind Chakram (4-bladed spinning glaive ring)
    this.ensureSingleTexture(scene, 'proj_chakram', 30, 30, (ctx) => {
      ctx.clearRect(0, 0, 30, 30);
      ctx.strokeStyle = '#ecfeff';
      ctx.fillStyle = '#2dd4bf';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(15 + Math.cos(a) * 5, 15 + Math.sin(a) * 5);
        ctx.lineTo(15 + Math.cos(a + 0.35) * 14, 15 + Math.sin(a + 0.35) * 14);
        ctx.lineTo(15 + Math.cos(a + 0.8) * 7, 15 + Math.sin(a + 0.8) * 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(15, 15, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#99f6e4';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    // 6. Nyx Void Orb (dark singularity core with violet corona)
    this.ensureSingleTexture(scene, 'proj_void_orb', 28, 28, (ctx) => {
      ctx.clearRect(0, 0, 28, 28);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(14, 14, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#3b0764';
      ctx.beginPath();
      ctx.arc(14, 14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090414';
      ctx.beginPath();
      ctx.arc(14, 14, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 7. Solarius Solar Hammer (radiant golden warhammer)
    this.ensureSingleTexture(scene, 'proj_solar_hammer', 32, 32, (ctx) => {
      ctx.clearRect(0, 0, 32, 32);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      // Handle
      ctx.fillStyle = '#b45309';
      ctx.fillRect(14, 14, 4, 15);
      ctx.strokeRect(14, 14, 4, 15);
      // Hammer head
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(6, 5, 20, 10);
      ctx.strokeRect(6, 5, 20, 10);
      // Sun core
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(16, 10, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 8. Chronos Temporal Needle (golden clock-hand spear pointing right -> 0 rad)
    this.ensureSingleTexture(scene, 'proj_temporal_needle', 34, 16, (ctx) => {
      ctx.clearRect(0, 0, 34, 16);
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(2, 8);
      ctx.lineTo(10, 4);
      ctx.lineTo(14, 6);
      ctx.lineTo(32, 8);
      ctx.lineTo(14, 10);
      ctx.lineTo(10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(10, 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 9. Alchemius Acid Flask (corked glass alchemical flask with bubbling neon-lime acid)
    this.ensureSingleTexture(scene, 'proj_acid_flask', 28, 28, (ctx) => {
      ctx.clearRect(0, 0, 28, 28);
      // Cork & Neck
      ctx.fillStyle = '#a16207';
      ctx.fillRect(11, 2, 6, 4);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(10, 5, 8, 4);
      // Bulb body
      ctx.fillStyle = '#1a2e05';
      ctx.strokeStyle = '#ecfccb';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(14, 17, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Bubbling toxic liquid
      ctx.fillStyle = '#84cc16';
      ctx.beginPath();
      ctx.arc(14, 18, 7.2, 0.15, Math.PI - 0.15);
      ctx.fill();
      ctx.fillStyle = '#bef264';
      ctx.beginPath();
      ctx.arc(12, 16, 2.2, 0, Math.PI * 2);
      ctx.arc(16, 19, 1.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // 10. Meteor Rain Falling Comet (blazing volcanic meteor boulder)
    this.ensureSingleTexture(scene, 'proj_meteor', 36, 36, (ctx) => {
      ctx.clearRect(0, 0, 36, 36);
      // Flame wake
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(6, 28);
      ctx.lineTo(18, 2);
      ctx.lineTo(34, 16);
      ctx.lineTo(24, 30);
      ctx.closePath();
      ctx.fill();
      // Molten rock core
      ctx.fillStyle = '#44403c';
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(16, 20, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(15, 20, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 11. Spirit Totem Pillar (ancestral carved emerald & gold runic totem)
    this.ensureSingleTexture(scene, 'proj_totem', 36, 44, (ctx) => {
      ctx.clearRect(0, 0, 36, 44);
      // Totem wings
      ctx.fillStyle = '#065f46';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(2, 14);
      ctx.lineTo(34, 14);
      ctx.lineTo(28, 22);
      ctx.lineTo(8, 22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Central carved pillar
      ctx.fillStyle = '#422006';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.fillRect(11, 6, 14, 32);
      ctx.strokeRect(11, 6, 14, 32);
      // Glowing spirit eyes & rune core
      ctx.fillStyle = '#6ee7b7';
      ctx.fillRect(13, 11, 3, 3);
      ctx.fillRect(20, 11, 3, 3);
      ctx.beginPath();
      ctx.arc(18, 24, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 12. Enemy Ranged Dark-Fantasy Energy Bolt (pointing right -> 0 rad)
    this.ensureSingleTexture(scene, 'enemy_proj_bolt', 24, 16, (ctx) => {
      ctx.clearRect(0, 0, 24, 16);
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(2, 8);
      ctx.lineTo(10, 2);
      ctx.lineTo(22, 8);
      ctx.lineTo(10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(13, 8, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    this.ensureSingleTexture(scene, 'particle_spark', 12, 12, (ctx) => {
      ctx.clearRect(0, 0, 12, 12);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    this.ensureSingleTexture(scene, 'hazard_crystal', 40, 40, (ctx) => {
      ctx.clearRect(0, 0, 40, 40);
      ctx.fillStyle = '#ec4899';
      ctx.strokeStyle = '#fbcfe8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 3);
      ctx.lineTo(34, 20);
      ctx.lineTo(20, 37);
      ctx.lineTo(6, 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    this.ensureSingleTexture(scene, 'hazard_mana_geyser', 44, 44, (ctx) => {
      ctx.clearRect(0, 0, 44, 44);
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(14, 165, 233, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(22, 22, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.arc(22, 22, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  static isValidTexture(scene, key, minFrames = 1) {
    if (!scene.textures.exists(key) || key === '__MISSING') return false;
    const tex = scene.textures.get(key);
    if (!tex || tex.key === '__MISSING') return false;
    const source = tex.source?.[0];
    if (!source || !source.width || !source.height) return false;
    if (minFrames > 1 && tex.frameTotal < minFrames) return false;
    return true;
  }

  static ensureSingleTexture(scene, key, width, height, drawFn) {
    if (this.isValidTexture(scene, key, 1)) return;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const canvasTex = scene.textures.createCanvas(key, width, height);
    const ctx = canvasTex.getContext();
    drawFn(ctx);
    canvasTex.refresh();
  }

  static ensureFourFrameSheet(scene, key, fw, fh, primaryHexInt, accentHexInt) {
    if (this.isValidTexture(scene, key, 4)) return;
    if (scene.textures.exists(key)) scene.textures.remove(key);

    const width = fw * 4;
    const height = fh;
    const canvasTex = scene.textures.createCanvas(key, width, height);
    const ctx = canvasTex.getContext();
    ctx.clearRect(0, 0, width, height);

    const primary = `#${primaryHexInt.toString(16).padStart(6, '0')}`;
    const accent = `#${accentHexInt.toString(16).padStart(6, '0')}`;

    for (let f = 0; f < 4; f++) {
      const ox = f * fw;
      const cx = ox + fw / 2;
      const cy = fh / 2 + (f === 1 || f === 2 ? -2 : 0);
      const legShift = f === 1 ? -3 : f === 2 ? 3 : 0;

      // Legs
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(cx - 6, cy + fh * 0.24 + legShift, fw * 0.08, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy + fh * 0.24 - legShift, fw * 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Cloak & Torso
      ctx.fillStyle = primary;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, fw * 0.22, fh * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Head
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(cx, cy - fh * 0.16, fw * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Accent Rune / Cast Glow
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(cx + (f === 3 ? fw * 0.22 : 0), cy, fw * (f === 3 ? 0.1 : 0.06), 0, Math.PI * 2);
      ctx.fill();

      canvasTex.add(f, 0, ox, 0, fw, fh);
    }

    canvasTex.refresh();
  }
}

export default AssetManager;
