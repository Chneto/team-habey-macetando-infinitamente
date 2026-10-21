import { CHARACTERS_DATA } from '../config/charactersData.js';
import {
  ACTIVE_SKILLS,
  PASSIVE_SKILLS,
  SYNERGY_EVOLUTIONS,
  DUAL_FUSIONS,
  LIMIT_BREAK_OPTIONS,
  rollCardRarity,
  getSkillById
} from '../config/skillsData.js';
import { ELEMENTAL_REACTIONS } from '../config/elementsData.js';
import { ENEMY_TYPES, MINI_BOSS_TEMPLATES, MAIN_BOSS_TEMPLATES } from '../config/enemiesData.js';
import saveManager, { TALENT_SHOP_ITEMS, ACHIEVEMENTS_DATA } from '../systems/SaveManager.js';
import soundManager from '../systems/SoundManager.js';
import a11yModalManager from './A11yModalManager.js';

export class UIManager {
  constructor(gameScene = null) {
    this.scene = gameScene;
    this.currentChoices = [];
    this.banishMode = false;
    this.bannerTimeout = null;
    this.saveNoticeTimeout = null;
    this.bindGlobalUiEvents();
    this.bindSaveEvents();
  }

  setGameScene(gameScene) {
    this.scene = gameScene;
  }

  bindSaveEvents() {
    window.addEventListener('habey:save-failed', (event) => {
      this.showSaveNotice(
        event.detail?.message || 'Não foi possível salvar seu progresso neste dispositivo.',
        'error'
      );
    });
    window.addEventListener('habey:save-recovered', (event) => {
      this.showSaveNotice(event.detail?.message || 'O jogo recuperou os dados salvos.', 'warning');
    });

    if (saveManager.startupNotice) {
      this.showSaveNotice(saveManager.startupNotice.message, saveManager.startupNotice.kind);
      saveManager.startupNotice = null;
    }
  }

  showSaveNotice(message, kind = 'warning') {
    const status = document.getElementById('save-status');
    if (!status) return;

    status.textContent = message;
    status.classList.toggle('is-error', kind === 'error');
    status.hidden = false;

    if (this.saveNoticeTimeout) clearTimeout(this.saveNoticeTimeout);
    this.saveNoticeTimeout = setTimeout(() => {
      status.hidden = true;
      this.saveNoticeTimeout = null;
    }, 8000);
  }

  bindGlobalUiEvents() {
    // VFX Opacity Slider (20% to 100%)
    const vfxSlider = document.getElementById('vfx-opacity-slider');
    const vfxLabel = document.getElementById('vfx-opacity-value');
    if (vfxSlider) {
      const initVal = Math.round(saveManager.getVfxOpacity() * 100);
      vfxSlider.value = String(initVal);
      if (vfxLabel) vfxLabel.textContent = `${initVal}%`;

      vfxSlider.oninput = (e) => {
        const pct = Number(e.target.value);
        saveManager.setVfxOpacity(pct / 100);
        if (vfxLabel) vfxLabel.textContent = `${pct}%`;
      };
    }

    // Level-Up Modal Action Buttons (Reroll, Banish, Skip)
    const rerollBtn = document.getElementById('btn-lvl-reroll');
    if (rerollBtn) {
      rerollBtn.onclick = () => {
        soundManager.playButtonClick();
        this.handleReroll();
      };
    }

    const banishBtn = document.getElementById('btn-lvl-banish');
    if (banishBtn) {
      banishBtn.onclick = () => {
        soundManager.playButtonClick();
        this.handleToggleBanishMode();
      };
    }

    const skipBtn = document.getElementById('btn-lvl-skip');
    if (skipBtn) {
      skipBtn.onclick = () => {
        soundManager.playButtonClick();
        this.handleSkipLevelUp();
      };
    }

    // Game Over Restart & Menu buttons
    const restartBtn = document.getElementById('btn-gameover-restart');
    if (restartBtn) {
      restartBtn.onclick = () => {
        a11yModalManager.close('gameover-modal');
        window.dispatchEvent(new CustomEvent('habey:start-run'));
      };
    }

    const toMenuBtn = document.getElementById('btn-gameover-menu');
    if (toMenuBtn) {
      toMenuBtn.onclick = () => {
        a11yModalManager.close('gameover-modal');
        window.dispatchEvent(new CustomEvent('habey:return-menu'));
      };
    }
  }

  // ===========================================================================
  // MAIN MENU, CHARACTER SELECT, TALENT SHOP & GRIMOIRE
  // ===========================================================================

  renderMainMenu() {
    this.updateMenuGoldDisplay();
    this.renderCharacterGrid();
    this.renderTalentShop();
    this.renderGrimoire();
  }

  updateMenuGoldDisplay() {
    const gold = saveManager.getGold();
    const els = document.querySelectorAll('.menu-gold-amount');
    els.forEach((el) => {
      el.textContent = String(gold);
    });
  }

  renderCharacterGrid() {
    const grid = document.getElementById('char-grid');
    if (!grid) return;

    const selectedId = saveManager.getSelectedCharacterId();
    grid.innerHTML = '';

    for (const char of CHARACTERS_DATA) {
      const unlocked = saveManager.isCharacterUnlocked(char.id);
      const isSelected = char.id === selectedId;

      const card = document.createElement('div');
      card.className = `char-card ${isSelected ? 'selected' : ''} ${unlocked ? 'unlocked' : 'locked'}`;
      card.dataset.charId = char.id;
      card.style.setProperty('--char-accent', char.hexColor);

      const extraStatBadge =
        char.stats.critChance >= 0.15
          ? `<span>🎯 Crit ${Math.round(char.stats.critChance * 100)}%</span>`
          : char.stats.armor > 0
          ? `<span>🛡️ Arm ${Math.round(char.stats.armor * 100)}%</span>`
          : `<span>⚔️ Dano ${Math.round(char.stats.damageMult * 100)}%</span>`;

      card.innerHTML = `
        <div class="char-card-header">
          <div class="char-avatar" style="border-color: ${char.hexColor}">
            <div class="char-sprite-preview" style="background-image: url('assets/sprites/${char.spriteKey}_hd.png'), url('assets/sprites/${char.spriteKey}.png')"></div>
            <span class="char-icon char-icon-badge">${char.icon}</span>
            ${char.hasFourArms ? '<span class="four-arms-badge" title="4 Braços Articulados">4 BRAÇOS</span>' : ''}
          </div>
          <div class="char-title-box">
            <h4>${char.name}</h4>
            <span class="char-element-tag" style="color: ${char.hexColor}">${char.elementLabel} • ${char.title}</span>
          </div>
        </div>
        <div class="char-visual-trait">${char.visualDescription}</div>
        <div class="char-stats-row">
          <span>❤️ HP ${char.stats.hp}</span>
          <span>👟 Vel ${Math.round(char.stats.speedMult * 100)}%</span>
          ${extraStatBadge}
        </div>
        <div class="char-weapon-line">
          <strong>Arma:</strong> ${char.starterSkillName}
        </div>
        <div class="char-passive-line">
          <strong>Inata (${char.innatePassive.name}):</strong> ${char.innatePassive.description}
        </div>
        <button class="btn-char-action ${isSelected ? 'btn-selected' : unlocked ? 'btn-select' : 'btn-unlock'}">
          ${
            isSelected
              ? '✔ SELECIONADO'
              : unlocked
              ? 'SELECIONAR MAGO'
              : `🔓 DESBLOQUEAR (${char.unlockCost} 💰)`
          }
        </button>
      `;

      card.onclick = () => {
        soundManager.playButtonClick();
        if (unlocked) {
          saveManager.selectCharacter(char.id);
          this.renderCharacterGrid();
        } else if (saveManager.unlockCharacter(char.id)) {
          soundManager.playLevelUp();
          saveManager.selectCharacter(char.id);
          this.updateMenuGoldDisplay();
          this.renderCharacterGrid();
        }
      };

      grid.appendChild(card);
    }
  }

  renderTalentShop() {
    const container = document.getElementById('talent-shop-list');
    if (!container) return;
    container.innerHTML = '';

    for (const item of TALENT_SHOP_ITEMS) {
      const lvl = saveManager.getTalentLevel(item.id);
      const cost = saveManager.getTalentCost(item.id);
      const isMax = lvl >= item.maxLevel;

      const card = document.createElement('div');
      card.className = `talent-card ${item.isUltimate ? 'talent-ultimate' : ''}`;
      card.innerHTML = `
        <div class="talent-top">
          <span class="talent-icon">${item.icon}</span>
          <div>
            <h4>${item.name}</h4>
            <span class="talent-lvl">Nível ${lvl} / ${item.maxLevel}</span>
          </div>
        </div>
        <p class="talent-desc">${item.description}</p>
        <button class="btn-buy-talent" ${isMax ? 'disabled' : ''}>
          ${isMax ? 'MÁXIMO ALCANÇADO' : `MELHORAR (${cost} 💰)`}
        </button>
      `;

      const btn = card.querySelector('.btn-buy-talent');
      if (btn && !isMax) {
        btn.onclick = () => {
          soundManager.playButtonClick();
          if (saveManager.buyTalent(item.id)) {
            soundManager.playEvolution();
            this.updateMenuGoldDisplay();
            this.renderTalentShop();
          }
        };
      }
      container.appendChild(card);
    }
  }

  renderGrimoire() {
    const container = document.getElementById('grimoire-content');
    if (!container) return;

    const activeHtml = ACTIVE_SKILLS.map((a) => {
      const discovered = saveManager.data.grimoireDiscovered.includes(a.id);
      return `
        <div class="grimoire-item ${discovered ? 'ach-unlocked' : ''}">
          <div class="grimoire-item-title">${a.icon} <strong>${a.name}</strong> <span class="badge-free-slot">${a.element.toUpperCase()}</span></div>
          <p>${a.description}</p>
        </div>
      `;
    }).join('');

    const passiveHtml = PASSIVE_SKILLS.map((p) => {
      const discovered = saveManager.data.grimoireDiscovered.includes(p.id);
      return `
        <div class="grimoire-item ${discovered ? 'ach-unlocked' : ''}">
          <div class="grimoire-item-title">${p.icon} <strong>${p.name}</strong></div>
          <p>${p.description}</p>
        </div>
      `;
    }).join('');

    const evoHtml = SYNERGY_EVOLUTIONS.map((e) => {
      const act = getSkillById(e.activeId);
      const pas = getSkillById(e.passiveId);
      return `
        <div class="grimoire-item">
          <div class="grimoire-item-title">${e.icon} <strong>${e.name}</strong> <span class="badge-free-slot">Libera 1 Slot Passivo</span></div>
          <div class="grimoire-recipe">${act?.icon || ''} ${act?.name} (Nv.5) + ${pas?.icon || ''} ${pas?.name} (Nv.5)</div>
          <p>${e.description}</p>
        </div>
      `;
    }).join('');

    const fusionHtml = DUAL_FUSIONS.map((f) => {
      const actA = getSkillById(f.activeAId);
      const actB = getSkillById(f.activeBId);
      return `
        <div class="grimoire-item fusion-item">
          <div class="grimoire-item-title">${f.icon} <strong>${f.name}</strong> <span class="badge-free-slot">Libera 1 Slot Ativo</span></div>
          <div class="grimoire-recipe">${actA?.icon || ''} ${actA?.name} (Nv.5) + ${actB?.icon || ''} ${actB?.name} (Nv.5)</div>
          <p>${f.description}</p>
        </div>
      `;
    }).join('');

    const reactionHtml = ELEMENTAL_REACTIONS.map(
      (r) => `
        <div class="grimoire-item">
          <div class="grimoire-item-title" style="color:${r.hex}"><strong>${r.name}</strong> (${r.elements.join(' + ').toUpperCase()})</div>
          <p>${r.description}</p>
        </div>
      `
    ).join('');

    const bestiaryHtml = [...ENEMY_TYPES, ...MINI_BOSS_TEMPLATES, ...MAIN_BOSS_TEMPLATES]
      .map(
        (m) => `
        <div class="grimoire-item bestiary-item">
          <div class="bestiary-header">
            <div class="bestiary-sprite" style="background-image: url('assets/sprites/${m.spriteKey || 'boss_archon'}_hd.png'), url('assets/sprites/${m.spriteKey || 'boss_archon'}.png')"></div>
            <div>
              <div class="grimoire-item-title"><strong>${m.name}</strong> <span class="badge-free-slot">${m.roleLabel || 'Chefe Arcano'}</span></div>
              <p>${m.visualTrait || 'Entidade abissal corrompida pelo éter.'}</p>
            </div>
          </div>
        </div>
      `
      )
      .join('');

    const achHtml = ACHIEVEMENTS_DATA.map((a) => {
      const unlocked = saveManager.data.achievements.includes(a.id);
      return `
        <div class="grimoire-item ${unlocked ? 'ach-unlocked' : 'ach-locked'}">
          <div class="grimoire-item-title">${a.icon} <strong>${a.name}</strong> ${unlocked ? '✅' : '🔒'}</div>
          <p>${a.description}</p>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <h4 class="grimoire-section-title">⚔️ 12 Habilidades Ativas Elementais</h4>
      <div class="grimoire-grid">${activeHtml}</div>
      <h4 class="grimoire-section-title">🛡️ Habilidades Passivas</h4>
      <div class="grimoire-grid">${passiveHtml}</div>
      <h4 class="grimoire-section-title">★ 12 Evoluções Sinérgicas (Ativa Nv.5 + Passiva Nv.5 → Libera 1 Slot Passivo)</h4>
      <div class="grimoire-grid">${evoHtml}</div>
      <h4 class="grimoire-section-title">★★ 6 Fusões Duplas de Armas (Ativa A Nv.5 + Ativa B Nv.5 → Libera 1 Slot Ativo)</h4>
      <div class="grimoire-grid">${fusionHtml}</div>
      <h4 class="grimoire-section-title">⚡ 7 Reações Elementais Cruzadas</h4>
      <div class="grimoire-grid">${reactionHtml}</div>
      <h5 class="grimoire-bestiary-subtitle">👹 Bestiário de Hordas & Arcontes</h5>
      <div class="grimoire-grid">${bestiaryHtml}</div>
      <h4 class="grimoire-section-title">🏆 Conquistas</h4>
      <div class="grimoire-grid">${achHtml}</div>
    `;
  }

  // ===========================================================================
  // IN-GAME HUD, SLOTS, BOSS BAR & EDGE INDICATOR ARROWS
  // ===========================================================================

  updateHud() {
    const scene = this.scene;
    const player = scene?.player;
    if (!player) return;

    // HP Bar
    const hpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const hpFill = document.getElementById('hud-hp-fill');
    const hpText = document.getElementById('hud-hp-text');
    if (hpFill) {
      hpFill.style.width = `${hpPct}%`;
      hpFill.classList.toggle('critical', hpPct <= 25);
    }
    if (hpText) {
      const shieldTxt =
        player.fairyShieldHp > 0 || player.barrierCharges > 0
          ? ` (+🛡️${player.fairyShieldHp + player.barrierCharges * 25})`
          : '';
      hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}${shieldTxt}`;
    }

    // XP Bar & Level
    const xpPct = Math.max(0, Math.min(100, (player.xp / player.xpToNext) * 100));
    const xpFill = document.getElementById('hud-xp-fill');
    const lvlBadge = document.getElementById('hud-level-badge');
    if (xpFill) xpFill.style.width = `${xpPct}%`;
    if (lvlBadge) lvlBadge.textContent = `NV. ${player.level}`;

    // Timer Clock (Locks during Main Boss!)
    const timerEl = document.getElementById('hud-timer');
    if (timerEl) {
      const totalSec = Math.floor(scene.runSeconds || 0);
      const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');
      timerEl.textContent = scene.isTimerLockedByBoss ? `🔒 ${mm}:${ss}` : `${mm}:${ss}`;
      timerEl.classList.toggle('timer-locked', Boolean(scene.isTimerLockedByBoss));
    }

    // Kills, Gold & Dash Charges
    const killsEl = document.getElementById('hud-kills');
    if (killsEl) killsEl.textContent = `💀 ${player.kills}`;

    const goldEl = document.getElementById('hud-gold');
    if (goldEl) goldEl.textContent = `💰 ${saveManager.getGold()}`;

    const dashEl = document.getElementById('hud-dash-charges');
    if (dashEl) {
      dashEl.textContent = `💨 Dash: ${player.dashCharges}/${player.maxDashCharges}`;
    }

    // 5 Active Slots & 5 Passive Slots
    this.renderSkillSlotsHud(player);

    // Boss / Mini-Boss Bar & 03:00 Blood Curse Sub-timer
    this.updateBossHud();

    // Off-screen Chest & Pet Cage Arrows
    this.updateEdgeArrows();
  }

  renderSkillSlotsHud(player) {
    const activeContainer = document.getElementById('hud-active-slots');
    const passiveContainer = document.getElementById('hud-passive-slots');
    if (!activeContainer || !passiveContainer) return;

    const activeEntries = Array.from(player.activeSkills.values());
    activeContainer.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const slot = activeEntries[i];
      const div = document.createElement('div');
      div.className = `hud-slot active-slot ${slot ? 'occupied' : 'empty'} ${slot?.isEvolution ? 'evolved' : ''}`;
      if (slot) {
        const lvlLabel = slot.data.stars === 2 ? '★★' : slot.data.stars === 1 ? '★' : `Nv.${slot.level}`;
        div.innerHTML = `
          <span class="slot-icon" title="${slot.data.name}">${slot.data.icon}</span>
          <span class="slot-lvl">${lvlLabel}</span>
        `;
      } else {
        div.innerHTML = `<span class="slot-empty-label">ATIVO ${i + 1}</span>`;
      }
      activeContainer.appendChild(div);
    }

    const passiveEntries = Array.from(player.passiveSkills.values());
    passiveContainer.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const slot = passiveEntries[i];
      const div = document.createElement('div');
      div.className = `hud-slot passive-slot ${slot ? 'occupied' : 'empty'}`;
      if (slot) {
        div.innerHTML = `
          <span class="slot-icon" title="${slot.data.name}">${slot.data.icon}</span>
          <span class="slot-lvl">Nv.${slot.level}</span>
        `;
      } else {
        div.innerHTML = `<span class="slot-empty-label">PASSIVO ${i + 1}</span>`;
      }
      passiveContainer.appendChild(div);
    }
  }

  updateBossHud() {
    const bossHud = document.getElementById('boss-hud');
    if (!bossHud || !this.scene?.spawnSystem) return;

    const boss = this.scene.spawnSystem.getActiveBoss();
    if (!boss) {
      bossHud.classList.add('hidden');
      return;
    }

    bossHud.classList.remove('hidden');
    const nameEl = document.getElementById('boss-hud-name');
    const affixEl = document.getElementById('boss-hud-affixes');
    const affinityEl = document.getElementById('boss-hud-affinity');
    const hpFill = document.getElementById('boss-hud-hp-fill');
    const subTimerEl = document.getElementById('boss-hud-subtimer');

    if (nameEl) nameEl.textContent = `${boss.isMilestoneBoss ? '👑' : boss.isBoss ? '💀' : '👹'} ${boss.template.name}`;
    if (affixEl) affixEl.textContent = `Afixos: ${boss.getAffixLabel()}`;
    if (affinityEl) affinityEl.textContent = boss.template.affinityLabel;
    if (hpFill) {
      const pct = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
      hpFill.style.width = `${pct}%`;
    }

    if (subTimerEl) {
      if (boss.isBoss) {
        const rem = Math.ceil(boss.suddenDeathRemainingSec);
        if (rem > 0) {
          const mm = String(Math.floor(rem / 60)).padStart(2, '0');
          const ss = String(rem % 60).padStart(2, '0');
          subTimerEl.textContent = `⏳ Morte Súbita em: ${mm}:${ss}`;
          subTimerEl.className = 'boss-subtimer';
        } else {
          subTimerEl.textContent = `🩸 MALDIÇÃO DE SANGUE ATIVA! (-HP/s)`;
          subTimerEl.className = 'boss-subtimer blood-curse-active';
        }
      } else {
        subTimerEl.textContent = 'Mini-Boss de Arena';
        subTimerEl.className = 'boss-subtimer';
      }
    }
  }

  updateEdgeArrows() {
    const container = document.getElementById('edge-indicators');
    if (!container || !this.scene?.player || !this.scene?.spawnSystem) return;

    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const px = this.scene.player.sprite.x;
    const py = this.scene.player.sprite.y;

    const targets = [
      ...this.scene.spawnSystem.chests.map((c) => ({ ...c, indicatorType: 'chest' })),
      ...this.scene.spawnSystem.cages.map((c) => ({ ...c, indicatorType: 'cage' }))
    ];

    container.innerHTML = '';

    for (const item of targets) {
      if (!item.active) continue;
      // Check if off-screen
      const isInside =
        item.x >= view.x + 20 &&
        item.x <= view.right - 20 &&
        item.y >= view.y + 20 &&
        item.y <= view.bottom - 20;
      if (isInside) continue;

      const dx = item.x - px;
      const dy = item.y - py;
      const distMeters = Math.max(1, Math.round(Math.hypot(dx, dy) / 32));
      const angle = Math.atan2(dy, dx);

      const halfW = window.innerWidth * 0.44;
      const halfH = window.innerHeight * 0.42;
      const indX = window.innerWidth / 2 + Math.cos(angle) * halfW;
      const indY = window.innerHeight / 2 + Math.sin(angle) * halfH;

      const badge = document.createElement('div');
      badge.className = `edge-arrow ${item.indicatorType === 'chest' ? 'edge-chest' : 'edge-cage'}`;
      badge.style.left = `${Math.max(36, Math.min(window.innerWidth - 90, indX))}px`;
      badge.style.top = `${Math.max(60, Math.min(window.innerHeight - 60, indY))}px`;
      badge.innerHTML = `${item.indicatorType === 'chest' ? '📦' : '🐾'} ${distMeters}m`;
      container.appendChild(badge);
    }
  }

  showBanner(text, colorHex = '#fbbf24') {
    const el = document.getElementById('event-banner');
    if (!el) return;
    el.textContent = text;
    el.style.borderColor = colorHex;
    el.style.color = colorHex;
    el.classList.remove('hidden');

    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      el.classList.add('hidden');
    }, 3200);
  }

  // ===========================================================================
  // LEVEL UP CARDS (RARITIES, SYNERGY HINTS, EVOLUTION/FUSION, REROLL/BANISH/SKIP)
  // ===========================================================================

  openLevelUpModal() {
    const modal = document.getElementById('levelup-modal');
    if (!modal || !this.scene?.player) return;

    this.banishMode = false;
    this.generateAndRenderLevelUpCards();
    a11yModalManager.open(modal);
  }

  closeLevelUpModal() {
    const modal = document.getElementById('levelup-modal');
    if (modal) a11yModalManager.close(modal);
    this.scene?.onLevelUpChoiceCompleted();
  }

  generateAndRenderLevelUpCards() {
    const player = this.scene.player;
    const cardCount = player.characterData.stats.levelUpCards || 3; // 4 for Chronos!
    const choices = [];

    // 1. Guaranteed Supreme Evolution (★) or Dual Fusion (★★) when requirements are met!
    const readyEvos = player.getAvailableEvolutionsAndFusions();
    for (const evoItem of readyEvos) {
      choices.push({
        choiceType: evoItem.kind,
        id: evoItem.recipe.id,
        data: evoItem.recipe,
        rarity: {
          id: 'supreme',
          name: evoItem.kind === 'fusion' ? 'FUSÃO DUPLA ★★' : 'EVOLUÇÃO SUPREMA ★',
          levelJump: 5,
          color: '#fde047',
          borderHex: '#eab308',
          badge: evoItem.kind === 'fusion' ? '★★ LIBERA 1 SLOT ATIVO!' : '★ LIBERA 1 SLOT PASSIVO!'
        },
        synergyHint:
          evoItem.kind === 'fusion'
            ? '🔥 Funde 2 Armas Nv.5 em 1 Super Arma e libera 1 Slot Ativo!'
            : '✨ Funde Ativa Nv.5 + Passiva Nv.5 e libera 1 Slot Passivo!'
      });
    }

    // 2. Build regular candidate pool respecting 5 Active and 5 Passive slot caps
    const pool = [];
    for (const act of ACTIVE_SKILLS) {
      if (player.consumedSkills.has(act.id) || player.banishedSkills.has(act.id)) continue;
      const existing = player.activeSkills.get(act.id);
      if (existing) {
        if (existing.level < 5) pool.push({ choiceType: 'active', id: act.id, data: act, currentLevel: existing.level });
      } else if (player.activeSkills.size < 5) {
        pool.push({ choiceType: 'active', id: act.id, data: act, currentLevel: 0 });
      }
    }

    for (const pas of PASSIVE_SKILLS) {
      if (player.consumedSkills.has(pas.id) || player.banishedSkills.has(pas.id)) continue;
      const existing = player.passiveSkills.get(pas.id);
      if (existing) {
        if (existing.level < 5) pool.push({ choiceType: 'passive', id: pas.id, data: pas, currentLevel: existing.level });
      } else if (player.passiveSkills.size < 5) {
        pool.push({ choiceType: 'passive', id: pas.id, data: pas, currentLevel: 0 });
      }
    }

    // Shuffle pool
    pool.sort(() => Math.random() - 0.5);

    for (const item of pool) {
      if (choices.length >= cardCount) break;
      const rarity = rollCardRarity(player.luckMult);
      const nextLvl = Math.min(5, item.currentLevel + rarity.levelJump);

      let synergyHint = '';
      if (item.choiceType === 'active') {
        const synPas = getSkillById(item.data.synergyPassiveId);
        const fusAct = getSkillById(item.data.fusionPartnerId);
        const hasPas = player.passiveSkills.has(item.data.synergyPassiveId);
        const hasFus = player.activeSkills.has(item.data.fusionPartnerId);
        synergyHint = `${hasPas ? '✅' : '🔗'} Evolui c/ ${synPas?.name || ''} | ${hasFus ? '✅' : '⚔️'} Funde c/ ${fusAct?.name || ''}`;
      } else {
        const synAct = getSkillById(item.data.synergyActiveId);
        const hasAct = player.activeSkills.has(item.data.synergyActiveId);
        synergyHint = `${hasAct ? '✅ PAR EQUIPADO:' : '🔗 Evolui:'} ${synAct?.name || ''}`;
      }

      choices.push({
        ...item,
        rarity,
        targetLevel: nextLvl,
        synergyHint
      });
    }

    // 3. Fallback to Limit Break options if all 5+5 slots are maxed
    if (choices.length === 0) {
      for (const lb of LIMIT_BREAK_OPTIONS) {
        choices.push({
          choiceType: 'limit_break',
          id: lb.id,
          data: lb,
          rarity: {
            id: 'legendary',
            name: 'LIMIT BREAK',
            levelJump: 1,
            color: '#fbbf24',
            borderHex: '#d97706',
            badge: 'LIMIT BREAK INFINITO'
          },
          synergyHint: 'Poder Além do Nível Máximo!'
        });
      }
    }

    this.currentChoices = choices;
    this.renderLevelUpCardsDom();
  }

  renderLevelUpCardsDom() {
    const container = document.getElementById('levelup-cards-container');
    if (!container || !this.scene?.player) return;

    const player = this.scene.player;
    container.innerHTML = '';

    for (const choice of this.currentChoices) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `lvl-card rarity-${choice.rarity.id} ${this.banishMode ? 'banish-target' : ''}`;
      card.style.borderColor = choice.rarity.borderHex;

      const lvlInfo =
        choice.choiceType === 'active' || choice.choiceType === 'passive'
          ? `Nv.${choice.currentLevel} ➔ Nv.${choice.targetLevel}`
          : choice.rarity.name;

      card.innerHTML = `
        <span class="lvl-card-rarity" style="background:${choice.rarity.borderHex}">${choice.rarity.badge}</span>
        <span class="lvl-card-icon">${choice.data.icon}</span>
        <span class="lvl-card-title">${choice.data.name}</span>
        <span class="lvl-card-step">${lvlInfo}</span>
        <span class="lvl-card-desc">${choice.data.description}</span>
        <span class="lvl-card-synergy">${choice.synergyHint}</span>
      `;

      card.onclick = () => this.selectLevelUpCard(choice);
      container.appendChild(card);
    }

    // Update Reroll / Banish button counters
    const rerollBtn = document.getElementById('btn-lvl-reroll');
    if (rerollBtn) {
      rerollBtn.textContent = `🎲 Reroll (${player.rerollsRemaining})`;
      rerollBtn.disabled = player.rerollsRemaining <= 0;
    }

    const banishBtn = document.getElementById('btn-lvl-banish');
    if (banishBtn) {
      banishBtn.textContent = this.banishMode
        ? '🚫 Clique na Carta para Banir'
        : `🚫 Banir (${player.banishesRemaining})`;
      banishBtn.disabled = player.banishesRemaining <= 0;
    }
  }

  selectLevelUpCard(choice) {
    const player = this.scene?.player;
    if (!player) return;

    if (this.banishMode && (choice.choiceType === 'active' || choice.choiceType === 'passive')) {
      player.banishedSkills.add(choice.id);
      player.banishesRemaining = Math.max(0, player.banishesRemaining - 1);
      this.banishMode = false;
      this.generateAndRenderLevelUpCards();
      return;
    }

    if (choice.choiceType === 'evolution' || choice.choiceType === 'fusion') {
      player.applyEvolutionOrFusion(choice.data);
    } else if (choice.choiceType === 'active') {
      player.addOrUpgradeActiveSkill(choice.id, choice.rarity.levelJump);
    } else if (choice.choiceType === 'passive') {
      player.addOrUpgradePassiveSkill(choice.id, choice.rarity.levelJump);
    } else if (choice.choiceType === 'limit_break') {
      player.limitBreakBonuses[choice.data.stat] += choice.data.amount;
      player.recalculateStats();
    }

    this.updateHud();
    this.closeLevelUpModal();
  }

  handleReroll() {
    const player = this.scene?.player;
    if (!player || player.rerollsRemaining <= 0) return;
    player.rerollsRemaining -= 1;
    this.generateAndRenderLevelUpCards();
  }

  handleToggleBanishMode() {
    const player = this.scene?.player;
    if (!player || player.banishesRemaining <= 0) return;
    this.banishMode = !this.banishMode;
    this.renderLevelUpCardsDom();
  }

  handleSkipLevelUp() {
    const player = this.scene?.player;
    if (!player) return;
    // Skip grants +50% XP toward next level without re-triggering infinite loop
    player.xp = Math.min(player.xpToNext - 1, player.xp + Math.floor(player.xpToNext * 0.5));
    this.updateHud();
    this.closeLevelUpModal();
  }

  // ===========================================================================
  // GAME OVER & DPS ANALYTICS REPORT
  // ===========================================================================

  showGameOverAnalytics() {
    const modal = document.getElementById('gameover-modal');
    if (!modal || !this.scene?.player) return;

    const player = this.scene.player;
    const elapsedSec = Math.max(1, Math.floor(this.scene.runSeconds || 1));
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const ss = String(elapsedSec % 60).padStart(2, '0');

    const summaryEl = document.getElementById('gameover-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="stat-pill">⏱️ Tempo: <strong>${mm}:${ss}</strong></div>
        <div class="stat-pill">⭐ Nível: <strong>${player.level}</strong></div>
        <div class="stat-pill">💀 Abates: <strong>${player.kills}</strong></div>
        <div class="stat-pill">💰 Ouro Ganho: <strong>+${player.goldEarned}</strong></div>
      `;
    }

    // Build DPS Rows for all Active Skills, Pets & Elemental Reactions
    const rows = [];
    for (const slot of player.activeSkills.values()) {
      rows.push({
        name: `${slot.data.icon} ${slot.data.name}`,
        type: slot.isEvolution ? 'Suprema' : `Ativa Nv.${slot.level}`,
        damage: Math.round(slot.totalDamage || 0)
      });
    }

    for (const pet of this.scene.spawnSystem?.pets || []) {
      rows.push({
        name: `${pet.petData.icon} Pet: ${pet.petData.name}`,
        type: 'Pet Autônomo',
        damage: Math.round(pet.totalDamage || 0)
      });
    }

    if (this.scene.combatSystem?.reactionDamageTotal > 0) {
      rows.push({
        name: '⚡ Reações Elementais Cruzadas',
        type: 'Sinergia',
        damage: Math.round(this.scene.combatSystem.reactionDamageTotal)
      });
    }

    const grandTotal = Math.max(1, rows.reduce((acc, r) => acc + r.damage, 0));
    rows.sort((a, b) => b.damage - a.damage);

    const tbody = document.getElementById('dps-analytics-tbody');
    if (tbody) {
      tbody.innerHTML = rows
        .map((r) => {
          const dps = (r.damage / elapsedSec).toFixed(1);
          const pct = ((r.damage / grandTotal) * 100).toFixed(1);
          return `
            <tr>
              <td>${r.name} <small class="dps-tag">${r.type}</small></td>
              <td>${r.damage.toLocaleString()}</td>
              <td>${dps}/s</td>
              <td>
                <div class="dps-bar-wrap">
                  <div class="dps-bar-fill" style="width:${pct}%"></div>
                  <span>${pct}%</span>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }

    soundManager.playBossSpawn();
    a11yModalManager.open(modal);
  }
}

export const uiManager = new UIManager();
export default uiManager;
