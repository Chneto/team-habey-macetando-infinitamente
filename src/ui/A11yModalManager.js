/**
 * A11yModalManager.js
 * Gerenciador de Acessibilidade (WCAG 2.2) para Diálogos e Modais HTML.
 * - Gerenciamento de foco: Foco inicial no elemento interativo principal.
 * - Trap de foco: Impede que a tecla Tab escape para o fundo ou canvas.
 * - Restauração de foco: Devolve o foco ao botão de abertura ao fechar.
 * - Suporte a tecla Escape para fechar modais não-críticos.
 */

export class A11yModalManager {
  constructor() {
    this.activeModal = null;
    this.previousFocus = null;
    this.onKeyDown = this.handleKeyDown.bind(this);
  }

  open(modalIdOrEl, triggerEl = null) {
    const modal = typeof modalIdOrEl === 'string' ? document.getElementById(modalIdOrEl) : modalIdOrEl;
    if (!modal) return;

    this.previousFocus = triggerEl || document.activeElement;
    this.activeModal = modal;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    // Foco no primeiro elemento interagível (priorizando botões de fechamento ou primeiro botão útil)
    setTimeout(() => {
      const focusable = this.getFocusableElements(modal);
      if (focusable.length > 0) {
        const preferred =
          focusable.find(
            (el) =>
              el.classList.contains('btn-close') ||
              el.classList.contains('btn-primary-glow') ||
              el.classList.contains('card-btn')
          ) || focusable[0];
        preferred.focus();
      }
    }, 50);

    document.addEventListener('keydown', this.onKeyDown);
  }

  close(modalIdOrEl = null) {
    const modal = modalIdOrEl
      ? (typeof modalIdOrEl === 'string' ? document.getElementById(modalIdOrEl) : modalIdOrEl)
      : this.activeModal;
    if (!modal) return;

    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');

    if (this.activeModal === modal) {
      document.removeEventListener('keydown', this.onKeyDown);
      this.activeModal = null;
    }

    if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
      try {
        this.previousFocus.focus();
      } catch (_e) {}
    }
  }

  closeAll() {
    const openModals = document.querySelectorAll('.modal-backdrop:not(.hidden)');
    for (const m of openModals) {
      m.classList.add('hidden');
      m.setAttribute('aria-hidden', 'true');
    }
    document.removeEventListener('keydown', this.onKeyDown);
    this.activeModal = null;
  }

  getFocusableElements(container) {
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selector)).filter((el) => {
      return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0;
    });
  }

  handleKeyDown(e) {
    if (!this.activeModal) return;

    if (e.key === 'Escape') {
      // Modais que podem ser fechados livremente por Escape
      if (
        this.activeModal.id === 'shop-modal' ||
        this.activeModal.id === 'grimoire-modal' ||
        this.activeModal.id === 'debug-modal' ||
        this.activeModal.id === 'pause-modal'
      ) {
        e.preventDefault();
        const closeBtn = this.activeModal.querySelector('.btn-close');
        if (closeBtn) closeBtn.click();
        else this.close();
      }
      return;
    }

    if (e.key === 'Tab') {
      const focusable = this.getFocusableElements(this.activeModal);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !this.activeModal.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !this.activeModal.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }
}

export const a11yModalManager = new A11yModalManager();
export default a11yModalManager;
