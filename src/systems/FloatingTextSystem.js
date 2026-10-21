/**
 * FloatingTextSystem.js
 * Sistema de Textos de Dano e Reações Elementais Flutuantes estilo RPG com Object Pooling.
 * Elimina Garbage Collection reutilizando instâncias de texto pré-alocadas.
 */

export class FloatingTextSystem {
  constructor(scene) {
    this.scene = scene;
    this.poolSize = 48;
    this.pool = [];
    this.activeTexts = [];

    this.initPool();
  }

  initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      const text = this.scene.add
        .text(0, 0, '', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#05070f',
          strokeThickness: 3.5,
          shadow: { offsetX: 1, offsetY: 2, color: '#000000', blur: 3, stroke: true, fill: true }
        })
        .setOrigin(0.5, 0.5)
        .setDepth(30) // Acima da penumbra de iluminação
        .setActive(false)
        .setVisible(false);

      this.pool.push(text);
    }
  }

  spawnDamageText(x, y, amount, options = {}) {
    const textObj = this.pool.pop();
    if (!textObj) return;

    const {
      isCrit = false,
      isDot = false,
      element = null,
      reactionName = null,
      isHeal = false
    } = options;

    let displayStr = String(Math.round(amount));
    let color = '#f1f5f9';
    let fontSize = isDot ? '13px' : '16px';
    let duration = 650;

    if (isHeal) {
      displayStr = `+${displayStr} PV`;
      color = '#34d399';
      fontSize = '17px';
    } else if (reactionName) {
      displayStr = `✨ ${reactionName}!`;
      color = '#e879f9';
      fontSize = '18px';
      duration = 850;
    } else if (isCrit) {
      displayStr = `💥 ${displayStr}!`;
      color = '#fde047';
      fontSize = '21px';
      duration = 800;
    } else if (element === 'fire') {
      color = '#fb923c';
    } else if (element === 'ice') {
      color = '#38bdf8';
    } else if (element === 'lightning') {
      color = '#facc15';
    } else if (element === 'poison') {
      color = '#4ade80';
    } else if (element === 'arcane') {
      color = '#c084fc';
    } else if (element === 'earth') {
      color = '#fbbf24';
    }

    textObj.setText(displayStr);
    textObj.setStyle({ color });
    textObj.setFontSize(fontSize);
    textObj.setPosition(x + (Math.random() - 0.5) * 20, y - 10 + (Math.random() - 0.5) * 10);
    textObj.setAlpha(1);
    textObj.setScale(isCrit ? 1.3 : 1);
    textObj.setActive(true);
    textObj.setVisible(true);

    const vx = (Math.random() - 0.5) * 35;
    const vy = -(60 + Math.random() * 40);

    const textRecord = {
      textObj,
      vx,
      vy,
      lifetime: duration,
      elapsed: 0
    };

    this.activeTexts.push(textRecord);
  }

  update(deltaMs) {
    const dt = deltaMs / 1000;
    for (let i = this.activeTexts.length - 1; i >= 0; i--) {
      const rec = this.activeTexts[i];
      rec.elapsed += deltaMs;

      // Movimento ascendente com gravidade suave
      rec.textObj.x += rec.vx * dt;
      rec.textObj.y += rec.vy * dt;
      rec.vy += 80 * dt; // Gravidade desacelerando a subida

      const progress = rec.elapsed / rec.lifetime;
      if (progress >= 0.6) {
        // Fade out nos últimos 40% de vida
        rec.textObj.setAlpha(Math.max(0, 1 - (progress - 0.6) / 0.4));
      }

      if (rec.elapsed >= rec.lifetime) {
        rec.textObj.setActive(false);
        rec.textObj.setVisible(false);
        this.pool.push(rec.textObj);
        this.activeTexts.splice(i, 1);
      }
    }
  }

  destroy() {
    for (const t of this.pool) {
      t.destroy();
    }
    for (const rec of this.activeTexts) {
      rec.textObj.destroy();
    }
    this.pool = [];
    this.activeTexts = [];
  }
}

export default FloatingTextSystem;
