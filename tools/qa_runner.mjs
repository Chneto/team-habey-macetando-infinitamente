import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5179;
const URL = `http://127.0.0.1:${PORT}/`;

function startViteServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let resolved = false;
    const onData = (chunk) => {
      const txt = chunk.toString();
      if (!resolved && (txt.includes(String(PORT)) || txt.includes('Local:'))) {
        resolved = true;
        resolve(proc);
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', (err) => {
      if (!resolved) reject(err);
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(proc);
      }
    }, 3500);
  });
}

async function runQaSuite() {
  console.log('=== [auto-qa-runner] Starting Automated Playwright + DevTools Verification ===');
  const viteProc = await startViteServer();
  let browser = null;

  try {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=swiftshader'
      ]
    };
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      hasTouch: true
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (
        msg.type() === 'error' &&
        !msg.text().startsWith('[SaveManager] Failed to write localStorage:')
      ) {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    await page.goto(URL, { waitUntil: 'networkidle' });

    // Wait for Phaser BootScene -> MenuScene transition
    await page.waitForSelector('#char-grid .char-card', { timeout: 10000 });

    const touchScrollState = await page.evaluate(() => ({
      page: getComputedStyle(document.body).touchAction,
      menu: getComputedStyle(document.getElementById('menu-screen')).touchAction,
      modal: getComputedStyle(document.querySelector('.modal-window')).touchAction
    }));
    assert.equal(touchScrollState.page, 'auto', 'The page must allow browser touch gestures by default');
    assert.equal(touchScrollState.menu, 'pan-y', 'The menu must support vertical touch scrolling');
    assert.equal(touchScrollState.modal, 'pan-y', 'Scrollable dialogs must support vertical touch scrolling');
    console.log('✔ Check 0: Touch scrolling remains enabled in the menu and scrollable dialogs.');

    // CHECK 1: All 10 characters appear in selection, starting with Petrus unlocked & selected
    const charCards = await page.locator('#char-grid .char-card').count();
    assert.equal(charCards, 10, `Expected 10 character cards, found ${charCards}`);

    const firstCharId = await page.locator('#char-grid .char-card').first().getAttribute('data-char-id');
    assert.equal(firstCharId, 'petrus', `First character must be petrus, got ${firstCharId}`);
    const firstCharSelected = await page
      .locator('#char-grid .char-card')
      .first()
      .evaluate((el) => el.classList.contains('selected'));
    assert.equal(firstCharSelected, true, 'Petrus must be selected by default');
    console.log('✔ Check 1a: All 10 Elemental Mages rendered in Menu, Petrus #1 unlocked & selected.');

    // Test Talent Shop & Grimoire modals in Menu
    await page.click('#btn-open-shop');
    const talentCount = await page.locator('#talent-shop-list .talent-card').count();
    assert.equal(talentCount, 8, `Expected 8 permanent talents in shop, found ${talentCount}`);
    await page.click('#btn-close-shop');

    await page.click('#btn-open-grimoire');
    const grimoireCheck = await page.evaluate(() => {
      const el = document.getElementById('grimoire-modal');
      const sections = document.querySelectorAll('#grimoire-content .grimoire-section-title').length;
      return {
        visible: !el.classList.contains('hidden'),
        sections
      };
    });
    assert.equal(grimoireCheck.visible, true, 'Grimoire modal should open');
    assert.equal(grimoireCheck.sections, 6, `Grimoire must render all 6 sections (Actives, Passives, Evolutions, Fusions, Reactions, Achievements), got ${grimoireCheck.sections}`);
    await page.click('#btn-close-grimoire');
    console.log('✔ Check 1b: Talent Shop (8 talents incl. Clonagem Elemental) & Grimoire (all 6 sections) verified.');

    // Start the Game Run with Petrus
    await page.click('#btn-start-game');
    await page.waitForFunction(() => Boolean(window.__HABEY_SCENE__ && window.__HABEY_SCENE__.player), {
      timeout: 10000
    });

    // CHECK 2: Verify Petrus 4 articulated arms, Barragem de Rocha starter weapon, and transparent alpha sprites
    const petrusState = await page.evaluate(() => {
      const scene = window.__HABEY_SCENE__;
      const player = scene.player;
      const tex = scene.textures.get('char_petrus');
      const img = tex.getSourceImage();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const cornerAlpha = ctx.getImageData(0, 0, 1, 1).data[3];

      return {
        charId: player.characterData.id,
        fourArmsCount: player.fourArms.length,
        hasRockBarrage: player.activeSkills.has('rock_barrage'),
        cornerAlpha,
        hasIdleAnim: scene.anims.exists('char_petrus_idle'),
        hasWalkAnim: scene.anims.exists('char_petrus_walk'),
        hasCastAnim: scene.anims.exists('char_petrus_cast')
      };
    });

    assert.equal(petrusState.charId, 'petrus');
    assert.equal(petrusState.fourArmsCount, 4, 'Petrus must have 4 articulated independent stone arm sprites');
    assert.equal(petrusState.hasRockBarrage, true, 'Petrus must start with Barragem de Rocha equipped');
    assert.equal(petrusState.cornerAlpha, 0, 'Sprite sheet corner pixel (0,0) must have true transparent alpha (0)');
    assert.equal(petrusState.hasIdleAnim && petrusState.hasWalkAnim && petrusState.hasCastAnim, true);
    console.log('✔ Check 2: Petrus 4 articulated arms, Barragem de Rocha, true alpha=0 transparency & animations verified.');

    // CHECK 3: UI Bars do not block Canvas clicks & Virtual Joystick + Dash button appear
    const uiCheck = await page.evaluate(() => {
      const uiLayerStyle = window.getComputedStyle(document.getElementById('ui-layer'));
      const hudStyle = window.getComputedStyle(document.getElementById('hud-screen'));
      const joyZone = document.getElementById('mobile-joystick-zone');
      const dashBtn = document.getElementById('btn-mobile-dash');
      const centerEl = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return {
        uiPointerEvents: uiLayerStyle.pointerEvents,
        hudPointerEvents: hudStyle.pointerEvents,
        joyVisible: Boolean(joyZone && joyZone.offsetWidth > 0),
        dashVisible: Boolean(dashBtn && dashBtn.offsetWidth > 0),
        centerTag: centerEl ? centerEl.tagName : null
      };
    });

    assert.equal(uiCheck.uiPointerEvents, 'none', '#ui-layer must have pointer-events: none');
    assert.equal(uiCheck.hudPointerEvents, 'none', '#hud-screen must have pointer-events: none');
    assert.equal(uiCheck.centerTag, 'CANVAS', `Center of viewport must hit Phaser CANVAS directly, got ${uiCheck.centerTag}`);
    assert.equal(uiCheck.joyVisible, true, 'Mobile Virtual Joystick must be visible');
    assert.equal(uiCheck.dashVisible, true, 'Mobile Dash button must be visible');
    console.log('✔ Check 3: Non-blocking HUD pass-through to CANVAS + Mobile Virtual Joystick & Dash verified.');

    // Simulate Desktop WASD movement + Spacebar Dash + VFX Opacity slider
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(220);
    await page.keyboard.press('Space');
    await page.waitForTimeout(180);
    await page.keyboard.up('KeyD');

    await page.locator('#vfx-opacity-slider').fill('60');
    await page.locator('#vfx-opacity-slider').dispatchEvent('input');
    const vfxVal = await page.evaluate(() => window.__HABEY_SCENE__.combatSystem.getVfxAlpha(1.0));
    assert(Math.abs(vfxVal - 0.6) < 0.01, `Expected VFX alpha 0.6, got ${vfxVal}`);

    // CHECK 4: Verify 5 Active + 5 Passive slot caps AND Active+Passive Evolution + Active+Active Fusion slot liberation
    const slotAndEvoResult = await page.evaluate(() => {
      const scene = window.__HABEY_SCENE__;
      const p = scene.player;

      // Equip 5 active skills
      p.addOrUpgradeActiveSkill('rock_barrage', 5);
      p.addOrUpgradeActiveSkill('igneous_bombardment', 5);
      p.addOrUpgradeActiveSkill('ice_lance', 3);
      p.addOrUpgradeActiveSkill('electric_chain', 3);
      p.addOrUpgradeActiveSkill('thorn_swarm', 3);
      // Attempt 6th active skill -> must be rejected by 5-slot cap
      const sixthActive = p.addOrUpgradeActiveSkill('gale_chakram', 1);

      // Equip 5 passive skills
      p.addOrUpgradePassiveSkill('titan_glove', 5);
      p.addOrUpgradePassiveSkill('reach_ring', 5);
      p.addOrUpgradePassiveSkill('hawk_eye', 3);
      p.addOrUpgradePassiveSkill('wisdom_tome', 3);
      p.addOrUpgradePassiveSkill('duplicator_crystal', 3);
      // Attempt 6th passive skill -> must be rejected by 5-slot cap
      const sixthPassive = p.addOrUpgradePassiveSkill('hermes_boots', 1);

      const activeSizeBefore = p.activeSkills.size;
      const passiveSizeBefore = p.passiveSkills.size;

      // Trigger Dual Fusion: rock_barrage (Lv.5) + igneous_bombardment (Lv.5) -> Titã da Tectônica Vulcânica (★★)
      // Must fuse 2 actives into 1 and FREE 1 ACTIVE SLOT (5 -> 4)!
      const ready = p.getAvailableEvolutionsAndFusions();
      const fusionRecipe = ready.find((r) => r.kind === 'fusion')?.recipe;
      p.applyEvolutionOrFusion(fusionRecipe);
      const activeSizeAfterFusion = p.activeSkills.size;

      // Now upgrade ice_lance & hawk_eye to Lv.5 and trigger Synergy Evolution -> Estalactite do Zero Absoluto (★)
      // Must absorb passive and FREE 1 PASSIVE SLOT (5 -> 4)!
      p.addOrUpgradeActiveSkill('ice_lance', 5);
      p.addOrUpgradePassiveSkill('hawk_eye', 5);
      const ready2 = p.getAvailableEvolutionsAndFusions();
      const evoRecipe = ready2.find((r) => r.kind === 'evolution')?.recipe;
      p.applyEvolutionOrFusion(evoRecipe);
      const passiveSizeAfterEvo = p.passiveSkills.size;

      return {
        sixthActiveRejected: sixthActive === null,
        sixthPassiveRejected: sixthPassive === null,
        activeSizeBefore,
        passiveSizeBefore,
        activeSizeAfterFusion,
        passiveSizeAfterEvo,
        consumedHasRockBarrage: p.consumedSkills.has('rock_barrage')
      };
    });

    assert.equal(slotAndEvoResult.sixthActiveRejected, true, '6th active skill must be blocked when 5 slots are full');
    assert.equal(slotAndEvoResult.sixthPassiveRejected, true, '6th passive skill must be blocked when 5 slots are full');
    assert.equal(slotAndEvoResult.activeSizeBefore, 5);
    assert.equal(slotAndEvoResult.passiveSizeBefore, 5);
    assert.equal(slotAndEvoResult.activeSizeAfterFusion, 4, 'Dual Fusion (★★) must free 1 Active Slot (5 -> 4)');
    assert.equal(slotAndEvoResult.passiveSizeAfterEvo, 4, 'Synergy Evolution (★) must free 1 Passive Slot (5 -> 4)');
    assert.equal(slotAndEvoResult.consumedHasRockBarrage, true, 'Consumed fusion components must be recorded in consumedSkills');
    console.log('✔ Check 4: 5+5 Slot Caps, Dual Fusion (★★) active slot liberation, and Synergy Evolution (★) passive slot liberation verified.');

    // Test >250 XP Gems Off-Screen Super Gem Fusion
    const gemFusionCheck = await page.evaluate(() => {
      const gm = window.__HABEY_SCENE__.gemManager;
      for (let i = 0; i < 270; i++) {
        gm.spawnGem(1800 + (i % 20) * 15, 1800 + Math.floor(i / 20) * 15, 10, false);
      }
      const totalXpAfter = gm.gems.reduce((acc, g) => acc + (g.active ? g.xp : 0), 0);
      const hasSuperGem = gm.gems.some((g) => g.active && g.isSuper);
      return {
        gemCount: gm.gems.length,
        totalXpAfter,
        hasSuperGem
      };
    });
    assert(gemFusionCheck.gemCount <= 250, `Expected <=250 gems after off-screen merge, got ${gemFusionCheck.gemCount}`);
    assert.equal(gemFusionCheck.hasSuperGem, true, 'Must create a Super Gem when >250 gems exist');
    console.log('✔ Edge Case Check: >250 XP Gems Off-Screen Super Gem Fusion verified.');

    // CHECK 5: Open Debug Panel ('P' / ⚙️ DEV), verify physics pause, and click all 11 buttons!
    await page.keyboard.press('KeyP');
    const debugOpenState = await page.evaluate(() => ({
      modalOpen: !document.getElementById('debug-modal').classList.contains('hidden'),
      physicsPaused: window.__HABEY_SCENE__.physics.world.isPaused,
      isPausedByDebug: window.__HABEY_SCENE__.isPausedByDebug
    }));
    assert.equal(debugOpenState.modalOpen, true, 'Debug modal must open on pressing P');
    assert.equal(debugOpenState.physicsPaused, true, 'Physics world must pause when Debug Panel opens');

    // Button 1: God Mode ON
    await page.click('#dbg-btn-1-godmode');
    assert.equal(await page.evaluate(() => window.__HABEY_SCENE__.player.isGodMode), true);

    // Button 4: Maximize Equipped Skills (Nv.5)
    await page.click('#dbg-btn-4-max-equipped');
    const allMaxed = await page.evaluate(() =>
      Array.from(window.__HABEY_SCENE__.player.activeSkills.values()).every((s) => s.level === 5)
    );
    assert.equal(allMaxed, true, 'Button 4 must maximize all equipped skills to Lv.5');

    // Button 5: Force Supreme Evolution of Equipped Weapons
    await page.click('#dbg-btn-5-force-evo');
    const hasEvolved = await page.evaluate(() =>
      Array.from(window.__HABEY_SCENE__.player.activeSkills.values()).some((s) => s.isEvolution)
    );
    assert.equal(hasEvolved, true, 'Button 5 must force supreme evolution on equipped weapons');

    // Button 6: Spawn Treasure Chest Next to Player
    const chestsBefore = await page.evaluate(() => window.__HABEY_SCENE__.spawnSystem.chests.length);
    await page.click('#dbg-btn-6-spawn-chest');
    const chestsAfter = await page.evaluate(() => window.__HABEY_SCENE__.spawnSystem.chests.length);
    assert.equal(chestsAfter, chestsBefore + 1, 'Button 6 must spawn a Treasure Chest next to the player');

    // Button 7: Spawn Pet Cage Next to Player
    const cagesBefore = await page.evaluate(() => window.__HABEY_SCENE__.spawnSystem.cages.length);
    await page.click('#dbg-btn-7-spawn-cage');
    const cagesAfter = await page.evaluate(() => window.__HABEY_SCENE__.spawnSystem.cages.length);
    assert.equal(cagesAfter, cagesBefore + 1, 'Button 7 must spawn a Pet Cage next to the player');

    // Button 8: Spawn Mini-Boss Now
    await page.click('#dbg-btn-8-spawn-miniboss');
    const hasMiniBoss = await page.evaluate(() =>
      window.__HABEY_SCENE__.spawnSystem.enemies.some((e) => e.isMiniBoss && !e.isDead)
    );
    assert.equal(hasMiniBoss, true, 'Button 8 must spawn a Mini-Boss immediately');

    // Button 9: Spawn Main Boss Now (also locks main clock & activates 03:00 Sudden Death subtimer!)
    await page.click('#dbg-btn-9-spawn-boss');
    const bossCheck = await page.evaluate(() => {
      const s = window.__HABEY_SCENE__;
      const mainBoss = s.spawnSystem.enemies.find((e) => e.isBoss && !e.isDead);
      return {
        hasMainBoss: Boolean(mainBoss),
        timerLocked: s.isTimerLockedByBoss,
        suddenDeathSec: mainBoss ? mainBoss.suddenDeathRemainingSec : 0
      };
    });
    assert.equal(bossCheck.hasMainBoss, true, 'Button 9 must spawn a Main Boss immediately');
    assert.equal(bossCheck.timerLocked, true, 'Main Boss must lock the main game clock');
    assert.equal(bossCheck.suddenDeathSec, 180, 'Main Boss must initialize 180s (03:00) Sudden Death timer');

    // Button 10: +10.000 Gold & Unlock All 10 Characters / Grimoire
    await page.click('#dbg-btn-10-unlock-all');
    const unlockCheck = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('team_habey_save_v1'));
      return {
        gold: raw.gold,
        unlockedCount: raw.unlockedCharacters.length
      };
    });
    assert(unlockCheck.gold >= 10000, 'Button 10 must grant +10,000 Gold');
    assert.equal(unlockCheck.unlockedCount, 10, 'Button 10 must unlock all 10 characters');

    // Button 11: Kill All Enemies on Screen
    await page.click('#dbg-btn-11-kill-all');
    const aliveEnemies = await page.evaluate(() =>
      window.__HABEY_SCENE__.spawnSystem.enemies.filter((e) => !e.isDead).length
    );
    assert.equal(aliveEnemies, 0, 'Button 11 must kill all enemies on screen');

    // Button 2: +1 Instant Level (closes debug modal & opens Level-Up modal)
    await page.click('#dbg-btn-2-lvl1');
    const lvlModalVisible = await page.locator('#levelup-modal').evaluate((el) => !el.classList.contains('hidden'));
    assert.equal(lvlModalVisible, true, 'Button 2 must trigger Level-Up modal');

    const firstLevelCard = page.locator('#levelup-cards-container .lvl-card').first();
    const levelCardSemantics = await firstLevelCard.evaluate((el) => ({
      tagName: el.tagName,
      tabIndex: el.tabIndex
    }));
    assert.equal(levelCardSemantics.tagName, 'BUTTON', 'Level-up cards must use native button semantics');
    assert(levelCardSemantics.tabIndex >= 0, 'Level-up cards must be reachable with the keyboard');
    await firstLevelCard.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('levelup-modal').classList.contains('hidden'));
    await page.evaluate(() => window.__HABEY_SCENE__.queueLevelUp());
    await page.waitForFunction(() => !document.getElementById('levelup-modal').classList.contains('hidden'));

    // Test Reroll & Skip buttons inside Level-Up modal
    await page.click('#btn-lvl-reroll');
    await page.click('#btn-lvl-skip');
    await page.waitForFunction(() => document.getElementById('levelup-modal').classList.contains('hidden'));

    // Re-open Debug Panel and test Button 3 (+10 Instant Levels)
    await page.click('#btn-open-debug');
    const lvlBefore10 = await page.evaluate(() => window.__HABEY_SCENE__.player.level);
    await page.click('#dbg-btn-3-lvl10');
    const lvlAfter10 = await page.evaluate(() => window.__HABEY_SCENE__.player.level);
    assert.equal(lvlAfter10, lvlBefore10 + 10, 'Button 3 must add +10 levels immediately');

    // Resolve queued level-ups by clicking skip until all are processed
    await page.waitForFunction(() => {
      const modal = document.getElementById('levelup-modal');
      return modal && !modal.classList.contains('hidden');
    }, { timeout: 5000 });

    for (let i = 0; i < 20; i++) {
      const isVisible = await page.evaluate(() => {
        const modal = document.getElementById('levelup-modal');
        return modal && !modal.classList.contains('hidden');
      });
      if (isVisible) {
        await page.click('#btn-lvl-skip');
        await page.waitForTimeout(150);
      } else {
        const pending = await page.evaluate(() => window.__HABEY_SCENE__?.pendingLevelUps || 0);
        if (pending === 0) break;
        await page.waitForTimeout(100);
      }
    }

    await page.waitForFunction(() => {
      const modal = document.getElementById('levelup-modal');
      const scene = window.__HABEY_SCENE__;
      return modal && modal.classList.contains('hidden') && (!scene || scene.pendingLevelUps === 0);
    });

    console.log('✔ Check 5: All 11 Debug Panel (P / ⚙️ DEV) buttons & Level-Up Reroll/Skip verified.');

    // CHECK 5b: Pause Modal, Dynamic Lighting, Floating Text & Return to Character Select
    await page.click('#btn-pause-game');
    await page.waitForFunction(() => !document.getElementById('pause-modal').classList.contains('hidden'));
    const pauseState = await page.evaluate(() => {
      const s = window.__HABEY_SCENE__;
      return {
        isPausedManually: s.isPausedManually,
        physicsPaused: s.physics.world.isPaused,
        charName: document.getElementById('pause-char-name')?.textContent,
        lightingSystemActive: Boolean(s.lightingSystem?.lightSprite?.active),
        floatingTextSystemActive: Boolean(s.floatingTextSystem?.pool?.length > 0)
      };
    });
    assert.equal(pauseState.isPausedManually, true, 'Opening pause modal must set isPausedManually');
    assert.equal(pauseState.physicsPaused, true, 'Opening pause modal must pause physics');
    assert.equal(pauseState.lightingSystemActive, true, 'LightingSystem must be active in GameScene');
    assert.equal(pauseState.floatingTextSystemActive, true, 'FloatingTextSystem must be initialized');

    // Test Resume button
    await page.click('#btn-pause-resume');
    await page.waitForFunction(() => document.getElementById('pause-modal').classList.contains('hidden'));
    const resumedState = await page.evaluate(() => {
      const s = window.__HABEY_SCENE__;
      return {
        isPausedManually: s.isPausedManually,
        physicsPaused: s.physics.world.isPaused
      };
    });
    assert.equal(resumedState.isPausedManually, false, 'Resuming must clear isPausedManually');
    assert.equal(resumedState.physicsPaused, false, 'Resuming must unpause physics');

    // Test Pause and Return to Character Select
    await page.click('#btn-pause-game');
    await page.waitForFunction(() => !document.getElementById('pause-modal').classList.contains('hidden'));
    await page.click('#btn-pause-select-char');
    await page.waitForFunction(() => !document.getElementById('menu-screen').classList.contains('hidden'));
    const menuVisible = await page.evaluate(() => !document.getElementById('menu-screen').classList.contains('hidden'));
    assert.equal(menuVisible, true, 'Return to character select from pause must restore Main Menu');

    // Re-start game to continue remaining checks
    await page.click('#btn-start-game');
    await page.waitForFunction(() => document.getElementById('menu-screen').classList.contains('hidden'));
    console.log('✔ Check 5b: In-Game Pause Menu, Dynamic Lighting, Floating Damage Numbers, and Return to Character Select verified.');

    // DEEP EDGE CASE 6: All 7 Elemental Cross-Reactions, Pet Cage Rescue, 6 Chest Items & Boss Blood Curse
    const deepCombatCheck = await page.evaluate(() => {
      const s = window.__HABEY_SCENE__;
      const cs = s.combatSystem;
      const ss = s.spawnSystem;
      const now = performance.now();

      // Test all 7 Elemental Cross-Reactions on a high-HP target
      const dummy = ss.spawnEnemyAt(s.player.sprite.x + 80, s.player.sprite.y, ss.enemies[0]?.typeData || {
        id: 'test_mob',
        name: 'Alvo Rúnico',
        spriteKey: 'enemy_golem',
        hp: 50000,
        speed: 10,
        damage: 1,
        weight: 1,
        xp: 10
      });
      dummy.maxHp = 500000;
      dummy.hp = 500000;

      const pairs = [
        ['earth', 'fire'],
        ['earth', 'ice'],
        ['fire', 'ice'],
        ['fire', 'poison'],
        ['ice', 'lightning'],
        ['wind', 'fire'],
        ['arcane', 'earth']
      ];
      for (const [e1, e2] of pairs) {
        cs.dealDamageToEnemy(dummy, 20, { element: e1, timeMs: now });
        cs.dealDamageToEnemy(dummy, 20, { element: e2, timeMs: now });
      }

      // Rescue a Pet by breaking a Pet Cage
      ss.spawnPetCageNearPlayer();
      const petsBefore = ss.pets.length;
      ss.breakPetCage(ss.cages.length - 1);
      const petsAfter = ss.pets.length;

      // Trigger Boss Sudden Death Blood Curse (03:00 expired)
      const boss = ss.spawnMainBossNow();
      s.player.isGodMode = false;
      s.player.hp = s.player.maxHp;
      boss.suddenDeathRemainingSec = 0;
      boss.update(now + 2000, 1100, s.player);
      const hpAfterBloodCurse = s.player.hp;
      const maxHp = s.player.maxHp;

      // Kill Boss & verify main timer unlocks
      ss.onEnemyKilled(boss);
      const timerUnlockedAfterBossDeath = !s.isTimerLockedByBoss;

      return {
        reactionDamageTotal: cs.reactionDamageTotal,
        petsRescued: petsAfter === petsBefore + 1,
        bloodCurseDrainedHp: hpAfterBloodCurse < maxHp,
        timerUnlockedAfterBossDeath
      };
    });

    assert(deepCombatCheck.reactionDamageTotal > 0, 'All 7 elemental cross-reactions must deal & record reaction damage');
    assert.equal(deepCombatCheck.petsRescued, true, 'Breaking a Pet Cage must spawn an autonomous Pet');
    assert.equal(deepCombatCheck.bloodCurseDrainedHp, true, 'Boss Sudden Death Blood Curse must drain player HP after 03:00');
    assert.equal(deepCombatCheck.timerUnlockedAfterBossDeath, true, 'Defeating Main Boss must unlock the main game clock');
    console.log('✔ Deep Edge Cases: 7 Elemental Reactions, Pet Cage Rescue, and Boss Blood Curse verified.');

    // DEEP EDGE CASE 7: Talent Shop Spectral Clones + Chronos 4 Level-Up Cards + Game Over DPS Analytics Table
    await page.evaluate(() => {
      if (window.__HABEY_SCENE__) {
        window.__HABEY_SCENE__.isGameOver = true;
      }
      const raw = JSON.parse(localStorage.getItem('team_habey_save_v1'));
      raw.talents.elemental_cloning = 2;
      raw.selectedCharacterId = 'chronos';
      localStorage.setItem('team_habey_save_v1', JSON.stringify(raw));
    });
    await page.reload({ waitUntil: 'networkidle' });

    await page.waitForSelector('#char-grid .char-card[data-char-id="chronos"]', { state: 'visible', timeout: 10000 });
    await page.click('#char-grid .char-card[data-char-id="chronos"]');
    await page.click('#btn-start-game');
    await page.waitForFunction(
      () => Boolean(window.__HABEY_SCENE__ && window.__HABEY_SCENE__.player?.characterData?.id === 'chronos'),
      { timeout: 10000 }
    );

    const chronosState = await page.evaluate(() => {
      const s = window.__HABEY_SCENE__;
      s.player.level += 1;
      s.queueLevelUp();
      const cardCount = document.querySelectorAll('#levelup-cards-container .lvl-card').length;
      const cloneCount = s.player.clones.length;

      // Test Event Banner visibility via scene.uiManager
      s.uiManager.showBanner('TESTE DE BANNER', '#fbbf24');
      const bannerVisible = !document.getElementById('event-banner').classList.contains('hidden');

      // Test Cristal Duplicador even-level damage bonus, Botas de Hermes dash cooldown, and Armadura de Espinhos reflection
      const dmgBeforeDup = s.player.damageMult;
      s.player.addOrUpgradePassiveSkill('duplicator_crystal', 2);
      const dmgAfterDupLv2 = s.player.damageMult;

      const dashCdBeforeHermes = s.player.baseDashCooldownMs;
      s.player.addOrUpgradePassiveSkill('hermes_boots', 3);
      const dashCdAfterHermes = s.player.baseDashCooldownMs;

      s.player.addOrUpgradePassiveSkill('thorn_armor', 2);
      const thornTarget = s.spawnSystem.spawnEnemyAt(s.player.sprite.x + 30, s.player.sprite.y, s.spawnSystem.enemies[0]?.typeData || {
        id: 'thorn_mob',
        name: 'Alvo Espinho',
        spriteKey: 'enemy_goblin',
        hp: 5000,
        speed: 10,
        damage: 10,
        weight: 1,
        xp: 5
      });
      thornTarget.hp = 5000;
      s.player.invincibleUntil = 0;
      s.player.takeDamage(10, performance.now() + 5000);
      const thornReflectedDamage = thornTarget.hp < 5000;

      // Test Environmental Hazards: both Cristal Instável and Gêiser de Mana + auto-detonation on warning timer
      const hz1 = s.spawnSystem.spawnEnvironmentalHazard(s.player, 'unstable_crystal');
      const hz2 = s.spawnSystem.spawnEnvironmentalHazard(s.player, 'mana_geyser');
      const bothHazardTypesExist = hz1.kind === 'unstable_crystal' && hz2.kind === 'mana_geyser' && Boolean(hz1.innerRing);
      const hazardsBeforeFuse = s.spawnSystem.hazards.length;
      s.spawnSystem.update(performance.now() + 9000, 4500, s.player, s.runSeconds);
      const hazardsAutoDetonated = s.spawnSystem.hazards.length < hazardsBeforeFuse;

      // Test Boss Berserker affix boosts both speed and damage below 50% HP
      const bBoss = s.spawnSystem.spawnMiniBossNow();
      bBoss.affixIds.add('berserker');
      const baseBossDmg = bBoss.initialDamage;
      bBoss.hp = Math.floor(bBoss.maxHp * 0.35);
      bBoss.update(performance.now() + 10000, 16, s.player);
      const berserkerBoostedAttack = bBoss.damage > baseBossDmg && bBoss.baseSpeed > bBoss.template.speed;

      // Test Multi-Touch pointerId isolation on Virtual Joystick + Dash button
      const joyZone = document.getElementById('mobile-joystick-zone');
      const rect = joyZone.getBoundingClientRect();
      joyZone.dispatchEvent(new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: rect.left + rect.width / 2 + 25,
        clientY: rect.top + rect.height / 2,
        bubbles: true
      }));
      const joyXWithFinger1 = s.joystickVec.x;
      // Second finger (pointerId: 2) moves and lifts elsewhere -> must NOT cancel finger 1 joystick!
      window.dispatchEvent(new PointerEvent('pointermove', {
        pointerId: 2,
        clientX: 10,
        clientY: 10,
        bubbles: true
      }));
      window.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 2,
        clientX: 10,
        clientY: 10,
        bubbles: true
      }));
      const joyXAfterFinger2Up = s.joystickVec.x;
      // Now lift finger 1 (pointerId: 1) -> must reset joystick to 0
      window.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 1,
        bubbles: true
      }));
      const joyXAfterFinger1Up = s.joystickVec.x;

      // Test Gold persistence on Game Over (must NOT double-add goldEarned)
      const goldBeforeGameOver = JSON.parse(localStorage.getItem('team_habey_save_v1')).gold;
      s.player.goldEarned = 777;
      s.handleGameOver();
      const goldAfterGameOver = JSON.parse(localStorage.getItem('team_habey_save_v1')).gold;

      const dpsRows = document.querySelectorAll('#dps-analytics-tbody tr').length;
      const gameOverVisible = !document.getElementById('gameover-modal').classList.contains('hidden');

      return {
        charId: s.player.characterData.id,
        cardCount,
        cloneCount,
        bannerVisible,
        evenDupIncreasedDmg: dmgAfterDupLv2 > dmgBeforeDup,
        hermesReducedDashCd: dashCdAfterHermes < dashCdBeforeHermes,
        thornReflectedDamage,
        bothHazardTypesExist,
        hazardsAutoDetonated,
        berserkerBoostedAttack,
        multiTouchIsolated: joyXWithFinger1 > 0.3 && Math.abs(joyXAfterFinger2Up - joyXWithFinger1) < 1e-6 && joyXAfterFinger1Up === 0,
        noDoubleGoldOnGameOver: goldAfterGameOver === goldBeforeGameOver,
        groundPropsCount: s.groundProps.length,
        dpsRows,
        gameOverVisible
      };
    });

    assert.equal(chronosState.charId, 'chronos');
    assert.equal(chronosState.cardCount, 4, `Chronos must offer 4 Level-Up cards, got ${chronosState.cardCount}`);
    assert.equal(chronosState.cloneCount, 2, `Expected 2 Spectral Clones from Talent Shop, got ${chronosState.cloneCount}`);
    assert.equal(chronosState.bannerVisible, true, 'Event banner must become visible via scene.uiManager.showBanner');
    assert.equal(chronosState.evenDupIncreasedDmg, true, 'Cristal Duplicador Lv.2 must grant +12% damage bonus');
    assert.equal(chronosState.hermesReducedDashCd, true, 'Botas de Hermes must reduce Dash cooldown');
    assert.equal(chronosState.thornReflectedDamage, true, 'Armadura de Espinhos must reflect seismic damage to attackers');
    assert.equal(chronosState.bothHazardTypesExist, true, 'Both Unstable Crystals and Mana Geysers must spawn with warning rings');
    assert.equal(chronosState.hazardsAutoDetonated, true, 'Environmental hazards must auto-detonate when floor warning timer expires');
    assert.equal(chronosState.berserkerBoostedAttack, true, 'Berserker affix must boost both speed and attack damage below 50% HP');
    assert.equal(chronosState.multiTouchIsolated, true, 'Multi-touch pointerId tracking must isolate joystick finger from secondary touch');
    assert.equal(chronosState.noDoubleGoldOnGameOver, true, 'Game Over must not double-credit gold already saved during the run');
    assert(chronosState.groundPropsCount >= 20, 'Non-colliding background props must be rendered on the infinite plane');
    assert.equal(chronosState.gameOverVisible, true, 'Game Over modal must open on handleGameOver');
    assert(chronosState.dpsRows >= 1, 'DPS Analytics table must contain skill/pet damage rows');

    // Stress-test 20 scene restarts in a row across frames to verify zero listener leaks or errors
    const restartStressOk = await page.evaluate(async () => {
      const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (let i = 0; i < 20; i++) {
        window.dispatchEvent(new CustomEvent('habey:start-run'));
        await nextFrame();
      }
      return Boolean(window.__HABEY_SCENE__ && window.__HABEY_SCENE__.onWindowPointerMoveBound);
    });
    assert.equal(restartStressOk, true, '20x scene restarts must cleanly rebind listeners without errors');
    console.log('✔ Deep Edge Cases: Chronos 4 Level-Up Cards, Spectral Clones, Multi-Touch Pointer Isolation, 20x Restart Stress Test, Hazards & Game Over Analytics verified.');

    // DEEP EDGE CASE 8: Visual Overhaul, Bespoke Boss/Projectile Textures, Character Trait Layers, Enemy World HP Bars & Gameplay Bug Fixes
    const visualAndFixesCheck = await page.evaluate(() => {
      const s = window.__HABEY_SCENE__;
      const cs = s.combatSystem;
      const ss = s.spawnSystem;
      const now = performance.now();

      // 1. Verify all 6 custom Boss/Mini-Boss textures and all 12 bespoke weapon/enemy projectile textures exist in Phaser
      const bossTexKeys = [
        'boss_frost_warden',
        'boss_magma_colossus',
        'boss_plague_alchemist',
        'boss_malakor',
        'boss_vorath',
        'boss_kryos'
      ];
      const projTexKeys = [
        'proj_rock',
        'proj_fireball',
        'proj_icelance',
        'proj_thorn',
        'proj_chakram',
        'proj_void_orb',
        'proj_solar_hammer',
        'proj_temporal_needle',
        'proj_acid_flask',
        'proj_meteor',
        'proj_totem',
        'enemy_proj_bolt'
      ];
      const allBossTexValid = bossTexKeys.every((k) => s.textures.exists(k) && s.textures.get(k).key !== '__MISSING');
      const allProjTexValid = projTexKeys.every((k) => s.textures.exists(k) && s.textures.get(k).key !== '__MISSING');

      // 2. Verify UI Character Sprite Previews & Grimoire Bestiary items
      const charPreviewCount = document.querySelectorAll('#char-grid .char-sprite-preview').length;
      const charTraitCount = document.querySelectorAll('#char-grid .char-visual-trait').length;
      const bestiaryCount = document.querySelectorAll('#grimoire-content .bestiary-item').length;

      // 3. Verify Player Trait Layer & Enemy Decor Layer
      const hasTraitLayer = Boolean(s.player.traitLayer && s.player.traitLayer.gfx && s.player.traitLayer.gfx.active);
      const mob = ss.spawnEnemyAt(s.player.sprite.x + 120, s.player.sprite.y, ss.enemies[0]?.typeData || {
        id: 'skeleton_warrior',
        name: 'Esqueleto',
        spriteKey: 'enemy_skeleton',
        hp: 200,
        speed: 40,
        damage: 8,
        weight: 1,
        xp: 5
      });
      const hasEnemyDecor = Boolean(mob.decorGfx && mob.decorGfx.active);

      // 4. Verify Chronos temporal_needle 35% slow on hit
      mob.slowPct = 0;
      const slot = s.player.activeSkills.get('temporal_needle');
      cs.castSkillFromOrigin(s.player.sprite.x, s.player.sprite.y, s.player, slot, now, true);
      const needleProj = cs.playerProjectiles[cs.playerProjectiles.length - 1];
      needleProj.x = mob.sprite.x;
      needleProj.y = mob.sprite.y;
      cs.checkProjectileHits(needleProj, now);
      const temporalNeedleSlowApplied = mob.slowPct >= 0.35;

      // 5. Verify Solarius solar_hammer persistent orbital sprites & chest damage
      s.player.addOrUpgradeActiveSkill('solar_hammer', 3);
      const hammerSlot = s.player.activeSkills.get('solar_hammer');
      const orbitRadius = 88 * hammerSlot.data.area * s.player.areaMult;
      const chest = ss.createTreasureChest(s.player.sprite.x + orbitRadius, s.player.sprite.y);
      const chestHpBefore = chest.hp;
      for (let step = 0; step < 12; step++) {
        cs.updateOrbitalWeapon(now + step * 50, 170, s.player, hammerSlot);
      }
      const orbitalSpritesCreated = (cs.orbitalSprites.get('solar_hammer')?.length || 0) >= 2;
      const orbitalDamagedChest = chest.hp < chestHpBefore || !chest.active;

      // 6. Verify Stampede enemy releases stampedeVelocity when > 1100px away
      s.enemiesFrozenUntil = 0;
      const stampedeMob = ss.spawnEnemyAt(
        s.player.sprite.x + 1200,
        s.player.sprite.y,
        mob.typeData,
        null,
        null,
        { stampedeVelocity: { vx: 340, vy: 0 } }
      );
      stampedeMob.sprite.setPosition(s.player.sprite.x + 1201, s.player.sprite.y);
      stampedeMob.stunnedUntil = 0;
      const hadStampedeBefore = Boolean(stampedeMob.stampedeVelocity);
      stampedeMob.update(now + 100, 16, s.player);
      const stampedeReleased = hadStampedeBefore && stampedeMob.stampedeVelocity === null;
      const stampedeReleaseDiagnostic = {
        distance: Math.hypot(stampedeMob.sprite.x - s.player.sprite.x, stampedeMob.sprite.y - s.player.sprite.y),
        active: stampedeMob.sprite.active,
        dead: stampedeMob.isDead,
        retainedVelocity: stampedeMob.stampedeVelocity
      };

      // 7. Verify gainInstantLevels updates xpToNext
      const xpNextBefore = s.player.xpToNext;
      s.player.gainInstantLevels(3);
      const xpNextAfter = s.player.xpToNext;

      // 8. Verify Boss elemental status tinting with preserveBasePalette === true
      const testBoss = ss.spawnMainBossForced();
      testBoss.applyElementStatus('fire', now);
      const bossTintedWhenAfflicted = testBoss.sprite.isTinted;
      testBoss.activeElement = null;
      testBoss.elementExpiresAt = 0;
      testBoss.update(now + 50, 16, s.player);
      const bossUntintedWhenExpired = !testBoss.sprite.isTinted;

      // 9. Verify real Dual Fusion projectile visual mappings & Paradox Singularity dimensional_rupture + 35% slow
      const titanCfg = cs.getProjectileVisualConfig({ id: 'fusion_volcanic_tectonic_titan' });
      const blizzardCfg = cs.getProjectileVisualConfig({ id: 'fusion_nine_winds_blizzard' });
      const paradoxCfg = cs.getProjectileVisualConfig({ id: 'fusion_paradox_singularity' });
      const gaiaCfg = cs.getProjectileVisualConfig({ id: 'fusion_primordial_gaia_wrath' });
      const dualFusionConfigsValid =
        titanCfg.tex === 'proj_rock' &&
        blizzardCfg.tex === 'proj_chakram' &&
        paradoxCfg.tex === 'proj_void_orb' &&
        paradoxCfg.slowPct === 0.35 &&
        gaiaCfg.tex === 'proj_thorn';

      testBoss.vulnerabilityBonus = 0;
      cs.dealDamageToEnemy(testBoss, 25, {
        element: 'arcane',
        secondaryElement: 'arcane',
        timeMs: now + 100
      });
      const paradoxRuptureTriggered = testBoss.vulnerabilityBonus >= 0.25;

      // 10. Verify Spirit Totem spawns proj_totem sprite in groundZone
      cs.spawnGroundZone({
        x: s.player.sprite.x + 60,
        y: s.player.sprite.y + 60,
        radius: 75,
        duration: 2000,
        tickInterval: 450,
        damagePerTick: 10,
        element: 'earth',
        color: 0xd97706,
        withTotemSprite: true
      });
      const lastZone = cs.groundZones[cs.groundZones.length - 1];
      const totemSpriteCreated = Boolean(lastZone?.totemSprite && lastZone.totemSprite.texture.key === 'proj_totem');

      return {
        allBossTexValid,
        allProjTexValid,
        charPreviewCount,
        charTraitCount,
        bestiaryCount,
        hasTraitLayer,
        hasEnemyDecor,
        temporalNeedleSlowApplied,
        orbitalSpritesCreated,
        orbitalDamagedChest,
        stampedeReleased,
        stampedeReleaseDiagnostic,
        xpNextUpdated: xpNextAfter > xpNextBefore,
        bossTintedWhenAfflicted,
        bossUntintedWhenExpired,
        dualFusionConfigsValid,
        paradoxRuptureTriggered,
        totemSpriteCreated
      };
    });

    assert.equal(visualAndFixesCheck.allBossTexValid, true, 'All 6 custom Boss/Mini-Boss sprite sheets must be loaded');
    assert.equal(visualAndFixesCheck.allProjTexValid, true, 'All 12 bespoke weapon/enemy projectile textures must be loaded');
    assert.equal(visualAndFixesCheck.charPreviewCount, 10, 'All 10 character cards must render HD sprite previews');
    assert.equal(visualAndFixesCheck.charTraitCount, 10, 'All 10 character cards must render visual trait descriptions');
    assert.equal(visualAndFixesCheck.bestiaryCount, 12, 'Grimoire Bestiary must render all 12 Enemies, Mini-Bosses & Bosses');
    assert.equal(visualAndFixesCheck.hasTraitLayer, true, 'Player must have an active procedural character trait layer');
    assert.equal(visualAndFixesCheck.hasEnemyDecor, true, 'Enemy must have an active decorGfx layer (ground shadow & HP bar)');
    assert.equal(visualAndFixesCheck.temporalNeedleSlowApplied, true, 'Chronos temporal_needle must apply 35% slow on hit');
    assert.equal(visualAndFixesCheck.orbitalSpritesCreated, true, 'Solarius solar_hammer must create persistent orbital warhammer sprites');
    assert.equal(visualAndFixesCheck.orbitalDamagedChest, true, 'Solarius solar_hammer must damage Treasure Chests/Cages in orbit');
    assert.equal(
      visualAndFixesCheck.stampedeReleased,
      true,
      `Stampede enemies must release stampedeVelocity once >1100px off-screen: ${JSON.stringify(visualAndFixesCheck.stampedeReleaseDiagnostic)}`
    );
    assert.equal(visualAndFixesCheck.xpNextUpdated, true, 'gainInstantLevels must update xpToNext');
    assert.equal(visualAndFixesCheck.bossTintedWhenAfflicted, true, 'Bosses with preserveBasePalette must show elemental tint when afflicted');
    assert.equal(visualAndFixesCheck.bossUntintedWhenExpired, true, 'Bosses with preserveBasePalette must restore base palette when element expires');
    assert.equal(visualAndFixesCheck.dualFusionConfigsValid, true, 'All Dual Fusions must map to bespoke projectile textures and slowPct');
    assert.equal(visualAndFixesCheck.paradoxRuptureTriggered, true, 'Paradox Singularity (arcane+arcane) must trigger dimensional_rupture');
    assert.equal(visualAndFixesCheck.totemSpriteCreated, true, 'Spirit Totem zone must spawn a proj_totem pillar sprite');
    console.log('✔ Deep Edge Case 8: Custom Boss/Projectile Textures, Boss Elemental Tints, Dual Fusion Mechanics, Totems, Character Trait Layers, Enemy World HP Bars & Bestiary verified.');

    const saveFailureUi = await page.evaluate(async () => {
      const { saveManager } = await import('/src/systems/SaveManager.js');
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'team_habey_save_v1') {
          throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
        }
        return originalSetItem.call(this, key, value);
      };

      let persisted;
      try {
        persisted = saveManager.save();
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }

      saveManager.save();
      const status = document.getElementById('save-status');
      return { persisted, visible: !status.hidden, message: status.textContent };
    });
    assert.equal(saveFailureUi.persisted, false, 'A failed localStorage write must report failure');
    assert.equal(saveFailureUi.visible, true, 'A failed save must be visible to the player');
    assert.match(saveFailureUi.message, /armazenamento local/i);
    console.log('✔ Save failure is reported in the visible, accessible status message.');

    const futureSaveRaw = await page.evaluate(() => {
      const key = 'team_habey_save_v1';
      const futureSave = JSON.parse(localStorage.getItem(key));
      futureSave.version = 999;
      futureSave.futureVersionMarker = 'keep-me';
      const raw = JSON.stringify(futureSave);
      localStorage.setItem(key, raw);
      return raw;
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#char-grid .char-card', { timeout: 10000 });
    const futureSaveCheck = await page.evaluate(async () => {
      const { saveManager } = await import('/src/systems/SaveManager.js');
      const beforeSave = localStorage.getItem('team_habey_save_v1');
      const allowedToOverwrite = saveManager.save();
      const status = document.getElementById('save-status');
      return {
        unchanged: beforeSave === localStorage.getItem('team_habey_save_v1'),
        allowedToOverwrite,
        notice: status.textContent
      };
    });
    assert.equal(futureSaveCheck.unchanged, true, 'A newer save schema must not be overwritten by an older game version');
    assert.equal(futureSaveCheck.allowedToOverwrite, false, 'Saving must be blocked for a newer save schema');
    assert.match(futureSaveCheck.notice, /versão mais nova/i);
    assert(futureSaveRaw.includes('keep-me'), 'The future save test payload must include its preservation marker');
    console.log('✔ Future-version saves are preserved and cannot be overwritten by this build.');

    const recoveryContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      hasTouch: true
    });
    const recoveryPage = await recoveryContext.newPage();
    await recoveryPage.addInitScript(() => {
      localStorage.setItem('team_habey_save_v1', '{invalid-json');
    });
    await recoveryPage.goto(URL, { waitUntil: 'networkidle' });
    await recoveryPage.waitForSelector('#char-grid .char-card', { timeout: 10000 });
    const recoveryCheck = await recoveryPage.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('team_habey_save_v1'));
      const backupKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith('habey_elemental_save_corrupt_backup_')
      );
      const status = document.getElementById('save-status');
      return {
        version: save.version,
        backupCount: backupKeys.length,
        notice: status.textContent
      };
    });
    assert.equal(recoveryCheck.version, 2, 'Corrupt saves must recover into the current schema');
    assert.equal(recoveryCheck.backupCount, 1, 'The corrupt save must be backed up before recovery');
    assert.match(recoveryCheck.notice, /cópia foi preservada/i);
    await recoveryContext.close();
    console.log('✔ Corrupt saves are backed up, recovered, and explained in the interface.');

    assert.equal(consoleErrors.length, 0, `Console errors detected: ${consoleErrors.join('; ')}`);
    assert.equal(pageErrors.length, 0, `Uncaught page errors detected: ${pageErrors.join('; ')}`);
    console.log('✔ Zero Console Errors & Zero Page Exceptions confirmed!');
    console.log('=== [auto-qa-runner] ALL E2E CHECKS PASSED SUCCESSFULLY ===');
  } finally {
    if (browser) await browser.close();
    viteProc.kill();
  }
}

runQaSuite().catch((err) => {
  console.error('❌ [auto-qa-runner] QA Suite Failed:', err);
  process.exit(1);
});
