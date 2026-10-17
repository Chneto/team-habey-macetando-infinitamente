import soundManager from '../systems/SoundManager.js';

export class GemManager {
  constructor(scene) {
    this.scene = scene;
    this.gems = [];
    this.pool = [];
  }

  spawnGem(x, y, xpValue = 6, isSuper = false) {
    let gem = this.pool.pop();
    const key = isSuper ? 'super_xp_gem' : 'xp_gem';

    if (gem) {
      gem.sprite.setTexture(key);
      gem.sprite.setPosition(x, y);
      gem.sprite.setActive(true).setVisible(true);
      gem.sprite.setScale(isSuper ? 1.2 : 1.0);
      gem.x = x;
      gem.y = y;
      gem.xp = xpValue;
      gem.isSuper = isSuper;
      gem.magnetized = false;
      gem.active = true;
    } else {
      const sprite = this.scene.add.image(x, y, key);
      sprite.setDepth(6);
      if (isSuper) sprite.setScale(1.2);
      gem = {
        sprite,
        x,
        y,
        xp: xpValue,
        isSuper,
        magnetized: false,
        active: true
      };
    }

    this.gems.push(gem);

    if (this.gems.length > 250) {
      this.mergeOffscreenGems();
    }

    return gem;
  }

  /**
   * When >250 gems exist, merges off-screen (or furthest) gems into a Super Gem
   * preserving exact total XP sum.
   */
  mergeOffscreenGems() {
    if (this.gems.length <= 250) return;

    const cam = this.scene.cameras.main;
    const viewLeft = cam.worldView.x - 40;
    const viewRight = cam.worldView.right + 40;
    const viewTop = cam.worldView.y - 40;
    const viewBottom = cam.worldView.bottom + 40;

    const offscreenIndices = [];
    for (let i = 0; i < this.gems.length; i++) {
      const g = this.gems[i];
      if (!g.active || g.isSuper || g.magnetized) continue;
      if (g.x < viewLeft || g.x > viewRight || g.y < viewTop || g.y > viewBottom) {
        offscreenIndices.push(i);
      }
    }

    // Fallback to oldest non-super gems if all >250 are on-screen
    if (offscreenIndices.length < 30) {
      for (let i = 0; i < this.gems.length && offscreenIndices.length < 60; i++) {
        const g = this.gems[i];
        if (g.active && !g.isSuper && !offscreenIndices.includes(i)) {
          offscreenIndices.push(i);
        }
      }
    }

    if (offscreenIndices.length < 2) return;

    let sumXp = 0;
    let avgX = 0;
    let avgY = 0;
    const toMergeCount = Math.min(offscreenIndices.length, 80);

    // Remove in reverse index order
    const targets = offscreenIndices.slice(0, toMergeCount).sort((a, b) => b - a);
    for (const idx of targets) {
      const g = this.gems[idx];
      sumXp += g.xp;
      avgX += g.x;
      avgY += g.y;
      this.recycleGemAt(idx);
    }

    avgX /= toMergeCount;
    avgY /= toMergeCount;
    this.spawnGem(avgX, avgY, sumXp, true);
  }

  attractAllGems() {
    for (const g of this.gems) {
      if (g.active) g.magnetized = true;
    }
  }

  findNearestGem(x, y, maxRadius = 260) {
    let best = null;
    let bestDistSq = maxRadius * maxRadius;
    for (const g of this.gems) {
      if (!g.active) continue;
      const dx = g.x - x;
      const dy = g.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = g;
      }
    }
    return best;
  }

  collectGem(gem) {
    const idx = this.gems.indexOf(gem);
    if (idx === -1 || !gem.active) return;

    const xpVal = gem.xp;
    const isSuper = gem.isSuper;
    this.recycleGemAt(idx);

    soundManager.playGemPickup(isSuper);
    if (this.scene.player) {
      this.scene.player.onGemCollected();
      this.scene.player.gainXp(xpVal);
    }
  }

  recycleGemAt(index) {
    const gem = this.gems[index];
    if (!gem) return;
    gem.active = false;
    gem.sprite.setActive(false).setVisible(false);
    this.pool.push(gem);
    const last = this.gems.pop();
    if (index < this.gems.length) {
      this.gems[index] = last;
    }
  }

  update(_timeMs, deltaMs, player) {
    if (!player || player.isDead) return;
    const px = player.sprite.x;
    const py = player.sprite.y;
    const radius = player.pickupRadius;
    const radiusSq = radius * radius;
    const dtSec = deltaMs / 1000;

    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      if (!g.active) continue;

      const dx = px - g.x;
      const dy = py - g.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radiusSq) {
        g.magnetized = true;
      }

      if (g.magnetized) {
        const dist = Math.sqrt(distSq) || 1;
        if (dist < 22) {
          this.collectGem(g);
          continue;
        }
        const pullSpeed = 520;
        g.x += (dx / dist) * pullSpeed * dtSec;
        g.y += (dy / dist) * pullSpeed * dtSec;
        g.sprite.setPosition(g.x, g.y);
      }
    }
  }
}

export default GemManager;
