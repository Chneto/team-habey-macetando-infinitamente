import {
  SYNERGY_EVOLUTIONS,
  DUAL_FUSIONS
} from '../config/skillsData.js';
import saveManager from '../systems/SaveManager.js';

export class DebugPanel {
  constructor(gameScene) {
    this.scene = gameScene;
    this.isOpen = false;
    this.modalEl = document.getElementById('debug-modal');
    this.bindEvents();
  }

  bindEvents() {
    const devBtn = document.getElementById('btn-open-debug');
    if (devBtn) {
      devBtn.onclick = () => this.toggle();
    }

    const closeBtn = document.getElementById('btn-close-debug');
    if (closeBtn) {
      closeBtn.onclick = () => this.close();
    }

    const bindAction = (id, fn) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.onclick = () => {
          fn();
          this.refreshLabels();
          this.scene.uiManager?.updateHud();
        };
      }
    };

    // 1. 🛡️ God Mode (Imortalidade ON/OFF)
    bindAction('dbg-btn-1-godmode', () => {
      if (!this.scene.player) return;
      this.scene.player.isGodMode = !this.scene.player.isGodMode;
      this.scene.uiManager?.showBanner(
        `🛡️ GOD MODE: ${this.scene.player.isGodMode ? 'ATIVADO' : 'DESATIVADO'}`,
        this.scene.player.isGodMode ? '#10b981' : '#f97316'
      );
    });

    // 2. ⬆️ +1 Nível Instantâneo
    bindAction('dbg-btn-2-lvl1', () => {
      if (!this.scene.player) return;
      this.scene.player.gainInstantLevels(1);
      this.close();
    });

    // 3. 🚀 +10 Níveis Instantâneos
    bindAction('dbg-btn-3-lvl10', () => {
      if (!this.scene.player) return;
      this.scene.player.gainInstantLevels(10);
      this.close();
    });

    // 4. ⭐ Maximizar Habilidades Equipadas (Nv. 5)
    bindAction('dbg-btn-4-max-equipped', () => {
      const player = this.scene.player;
      if (!player) return;
      for (const slot of player.activeSkills.values()) {
        slot.level = 5;
      }
      for (const slot of player.passiveSkills.values()) {
        slot.level = 5;
      }
      player.recalculateStats();
      this.scene.uiManager?.showBanner('⭐ TODAS AS HABILIDADES EQUIPADAS NO NÍVEL 5!', '#fbbf24');
    });

    // 5. 🔥 Forçar Evolução Suprema das Armas Equipadas
    bindAction('dbg-btn-5-force-evo', () => {
      const player = this.scene.player;
      if (!player) return;

      // Ensure all equipped actives & passives are Lv.5
      for (const slot of player.activeSkills.values()) slot.level = 5;
      for (const slot of player.passiveSkills.values()) slot.level = 5;

      let evolvedCount = 0;

      // Check Dual Fusions first if both partners are equipped
      for (const fus of DUAL_FUSIONS) {
        if (player.activeSkills.has(fus.activeAId) && player.activeSkills.has(fus.activeBId)) {
          player.applyEvolutionOrFusion(fus);
          evolvedCount++;
        }
      }

      // Check Synergy Evolutions (auto-equip required passive at Lv.5 if not present so evolution always succeeds)
      for (const evo of SYNERGY_EVOLUTIONS) {
        if (player.activeSkills.has(evo.activeId)) {
          if (!player.passiveSkills.has(evo.passiveId) && player.passiveSkills.size < 5) {
            player.addOrUpgradePassiveSkill(evo.passiveId, 5);
          } else if (player.passiveSkills.has(evo.passiveId)) {
            player.passiveSkills.get(evo.passiveId).level = 5;
          }
          if (player.passiveSkills.has(evo.passiveId)) {
            player.applyEvolutionOrFusion(evo);
            evolvedCount++;
          }
        }
      }

      player.recalculateStats();
      this.scene.uiManager?.showBanner(
        `🔥 EVOLUÇÃO SUPREMA FORÇADA (${evolvedCount} ARMA(S) EVOLUÍDA(S))!`,
        '#c084fc'
      );
    });

    // 6. 📦 Spawnar Baú de Tesouro ao Lado
    bindAction('dbg-btn-6-spawn-chest', () => {
      this.scene.spawnSystem?.spawnTreasureChestNearPlayer();
      this.scene.uiManager?.showBanner('📦 BAÚ DE TESOURO SPAWNADO AO LADO!', '#fbbf24');
    });

    // 7. 🐾 Spawnar Jaula de Pet ao Lado
    bindAction('dbg-btn-7-spawn-cage', () => {
      this.scene.spawnSystem?.spawnPetCageNearPlayer();
      this.scene.uiManager?.showBanner('🐾 JAULA DE PET SPAWNADA AO LADO!', '#10b981');
    });

    // 8. 👹 Spawnar Mini-Boss Agora
    bindAction('dbg-btn-8-spawn-miniboss', () => {
      this.scene.spawnSystem?.spawnMiniBossNow();
    });

    // 9. 💀 Spawnar Boss Principal Agora
    bindAction('dbg-btn-9-spawn-boss', () => {
      this.scene.spawnSystem?.spawnMainBossNow();
    });

    // 10. 💰 +10.000 Ouro & Desbloquear Todos os 10 Personagens/Grimório
    bindAction('dbg-btn-10-unlock-all', () => {
      saveManager.unlockAllDebug();
      if (this.scene.player) {
        this.scene.player.goldEarned += 10000;
      }
      this.scene.uiManager?.showBanner(
        '💰 +10.000 OURO & TODOS OS 10 PERSONAGENS E GRIMÓRIO DESBLOQUEADOS!',
        '#fde047'
      );
    });

    // 11. 💥 Matar Todos os Inimigos na Tela
    bindAction('dbg-btn-11-kill-all', () => {
      this.scene.spawnSystem?.killAllEnemiesOnScreen(false);
      this.scene.uiManager?.showBanner('💥 TODOS OS INIMIGOS NA TELA ELIMINADOS!', '#ef4444');
    });
  }

  refreshLabels() {
    const godBtn = document.getElementById('dbg-btn-1-godmode');
    if (godBtn && this.scene.player) {
      const state = this.scene.player.isGodMode ? 'ON' : 'OFF';
      godBtn.textContent = `🛡️ God Mode (Imortalidade ${state})`;
      godBtn.classList.toggle('godmode-active', this.scene.player.isGodMode);
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (!this.modalEl || this.scene.isGameOver) return;
    this.isOpen = true;
    this.scene.physics.pause();
    this.scene.isPausedByDebug = true;
    this.refreshLabels();
    this.modalEl.classList.remove('hidden');
  }

  close() {
    if (!this.modalEl) return;
    this.isOpen = false;
    this.scene.isPausedByDebug = false;
    this.modalEl.classList.add('hidden');
    if (!this.scene.isPausedByLevelUp && !this.scene.isGameOver) {
      this.scene.physics.resume();
    }
  }
}

export default DebugPanel;
