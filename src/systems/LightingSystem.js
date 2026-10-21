/**
 * LightingSystem.js
 * Sistema de Iluminação Dinâmica Dark Fantasy & Efeitos de Atmosfera para Phaser 3 WebGL.
 * - Penumbra ambiente / vinheta gótica com pulso de respiração arcana ao redor do herói.
 * - Suporte a pontos de luz dinâmicos (tochas de mapa, braseiros e projéteis flamejantes).
 * - Renderização suave com Canvas Texture dinâmica otimizada sem impacto de GC.
 */

export class LightingSystem {
  constructor(scene) {
    this.scene = scene;
    this.canvasTex = null;
    this.lightSprite = null;
    this.width = scene.scale?.width || 1280;
    this.height = scene.scale?.height || 720;
    this.pulsePhase = 0;
    this.secondaryLights = [];
    this.enabled = true;
    this.darknessAlpha = 0.72; // Intensidade da penumbra gótica

    this.initLightingCanvas();
  }

  initLightingCanvas() {
    try {
      const key = '__dyn_lighting_mask__';
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key);
      }

      const w = Math.max(100, Math.floor(this.width || 1280));
      const h = Math.max(100, Math.floor(this.height || 720));

      this.canvasTex = this.scene.textures.createCanvas(key, w, h);
      if (!this.canvasTex) return;

      this.ctx = this.canvasTex.getContext();
      this.ctx.fillStyle = `rgba(7, 9, 18, ${this.darknessAlpha})`;
      this.ctx.fillRect(0, 0, w, h);
      this.canvasTex.refresh();

      this.lightSprite = this.scene.add
        .image(0, 0, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(25);

      this.lightSprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
    } catch (e) {
      console.warn('[LightingSystem] Initialization error:', e);
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.lightSprite) {
      this.lightSprite.destroy();
    }
    this.initLightingCanvas();
  }

  update(timeMs, player, projectiles = [], torches = []) {
    if (!this.enabled || !this.ctx || !this.lightSprite || !player || !player.sprite) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Limpa e preenche o canvas com a cor da escuridão ambiente dark fantasy
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(7, 9, 18, ${this.darknessAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // Modo destination-out apaga a escuridão onde os círculos de luz forem desenhados
    ctx.globalCompositeOperation = 'destination-out';

    // 2. Luz Principal ao redor do Mago (Aura Arcana com respiração pulsante)
    const cam = this.scene.cameras.main;
    const screenPx = player.sprite.x - cam.scrollX;
    const screenPy = player.sprite.y - cam.scrollY;

    const pulse = Math.sin(timeMs * 0.0024) * 16;
    const playerRadius = Math.max(180, 270 + pulse);

    const grad = ctx.createRadialGradient(screenPx, screenPy, 25, screenPx, screenPy, playerRadius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');     // 100% iluminado no centro
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.85)'); // Luz arcana envolvente
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.35)'); // Penumbra suave
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');      // Transição para a escuridão total

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(screenPx, screenPy, playerRadius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Luzes de Tochas e Braseiros Místicos visíveis na tela
    for (const torch of torches) {
      const tx = torch.x - cam.scrollX;
      const ty = torch.y - cam.scrollY;
      if (tx >= -100 && tx <= w + 100 && ty >= -100 && ty <= h + 100) {
        const torchPulse = Math.sin(timeMs * 0.008 + (torch.seed || 0)) * 6;
        const torchRadius = Math.max(60, 110 + torchPulse);
        const tGrad = ctx.createRadialGradient(tx, ty, 8, tx, ty, torchRadius);
        tGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
        tGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.5)');
        tGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.arc(tx, ty, torchRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Luzes de Projéteis Flamejantes e Arcanos (Fogo, Raio, Meteoro)
    for (let i = 0; i < projectiles.length && i < 12; i++) {
      const p = projectiles[i];
      if (!p || !p.active) continue;
      const elem = p.element || p.weaponData?.element;
      if (elem === 'fire' || elem === 'lightning' || elem === 'arcane') {
        const px = p.x - cam.scrollX;
        const py = p.y - cam.scrollY;
        if (px >= -50 && px <= w + 50 && py >= -50 && py <= h + 50) {
          const pRad = elem === 'fire' ? 70 : 55;
          const pGrad = ctx.createRadialGradient(px, py, 4, px, py, pRad);
          pGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
          pGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(px, py, pRad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Restaura modo de composição padrão
    ctx.globalCompositeOperation = 'source-over';
    this.canvasTex.refresh();
  }

  destroy() {
    if (this.lightSprite) {
      this.lightSprite.destroy();
      this.lightSprite = null;
    }
    if (this.canvasTex && this.scene.textures.exists('__dyn_lighting_mask__')) {
      this.scene.textures.remove('__dyn_lighting_mask__');
      this.canvasTex = null;
    }
  }
}

export default LightingSystem;
