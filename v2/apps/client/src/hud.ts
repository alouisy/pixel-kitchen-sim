import { cravings } from '@ga/content';
import type { DishTier, GameHud, HudState } from '@ga/sim';
import { TIER_COLOR, cravingText, glyph, t, type Device, type StringKey } from './strings.js';
import type { MenuCommand } from './input.js';

const PROMPT_KEY = new Map(cravings.map((c) => [c.id, c.prompt]));
export const cravingName = (id: string): string => cravingText(PROMPT_KEY.get(id) ?? id);

const CRAVING_ICON: Record<string, string> = {
  ch1_seared_mushroom: '🍄',
  ch1_tall_tower: '🗼',
  ch1_crunchy_hot: '🔥',
};
const BELLY_FACE = ['😊', '🙂', '😟', '😡'] as const;
const BELLY_COLOR = ['#6fd36f', '#c9d96a', '#f4a259', '#e4572e'] as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface MenuButton {
  label: () => string;
  onSelect: () => void;
}
export interface MenuSpec {
  id: 'title' | 'results' | 'pause';
  title: string;
  subtitle?: string;
  /** Extra content between the header and the buttons. */
  body?: (parent: HTMLElement) => void;
  buttons: MenuButton[];
}

/** DOM HUD: craving card, timer + score, belly meter, tool card, tutorial banner, prompts, toasts and the menu cards. */
export class Hud {
  private readonly root = el('div', 'ui', document.body);
  private readonly game = el('div', 'ui-game', this.root);
  private readonly cravingCard = el('div', 'card craving-card', this.game);
  private readonly cravingIcon = el('div', 'craving-icon', this.cravingCard);
  private readonly cravingLabel: HTMLDivElement;
  private readonly cravingText: HTMLDivElement;
  private readonly cravingBar: HTMLElement;
  private readonly centerTop = el('div', 'center-top', this.game);
  private readonly timer = el('div', 'timer', this.centerTop);
  private readonly scoreEl = el('div', 'score', this.centerTop);
  private readonly bellyCard = el('div', 'card belly-card', this.game);
  private readonly bellyFace = el('div', 'belly-face', this.bellyCard);
  private readonly bellyBar: HTMLElement;
  private readonly bellyHearts: HTMLDivElement;
  private readonly toolCard = el('div', 'card tool-card', this.game);
  private readonly toolIcon = el('div', 'tool-icon', this.toolCard);
  private readonly toolName: HTMLDivElement;
  private readonly toolKeys: HTMLDivElement;
  private readonly legend = el('div', 'card legend', this.game);
  private readonly banner = el('div', 'banner', this.root);
  private readonly bannerStep = el('div', 'banner-step', this.banner);
  private readonly bannerTitle = el('div', 'banner-title', this.banner);
  private readonly bannerHint = el('div', 'banner-hint', this.banner);
  private readonly skip = el('div', 'skip-hint', this.root);
  private readonly skipText = el('span', '', this.skip);
  private readonly skipBar: HTMLElement;
  private readonly prompt = el('div', 'prompt', this.root);
  private readonly serve = el('div', 'serve-pop', this.root);
  private readonly toast = el('div', 'toast', this.root);
  private readonly overlay = el('div', 'overlay', this.root);
  readonly debug: HTMLPreElement;

  private device: Device = 'keyboard';
  private lastGame: GameHud | null = null;
  private lastHud: HudState | null = null;
  private serveTimer = 0;
  private toastTimer = 0;
  private menu: MenuSpec | null = null;
  private menuButtons: HTMLButtonElement[] = [];
  private menuFocus = 0;
  private menuHint: HTMLElement | null = null;
  private menuReadyAt = 0;
  private cache = new Map<string, string>();

  constructor(debugEnabled: boolean) {
    const body = el('div', 'craving-body', this.cravingCard);
    this.cravingLabel = el('div', 'craving-label', body, t('craving.label'));
    this.cravingText = el('div', 'craving-text', body);
    this.cravingBar = el('i', '', el('div', 'bar', body));
    this.bellyBar = el('i', '', el('div', 'bar belly-bar', this.bellyCard));
    this.bellyHearts = el('div', 'belly-hearts', this.bellyCard);
    this.toolName = el('div', 'tool-name', this.toolCard);
    this.toolKeys = el('div', 'tool-keys', this.toolCard);
    this.skipBar = el('i', '', el('div', 'bar', this.skip));
    this.debug = el('pre', 'hud-debug', document.body);
    this.debug.style.display = debugEnabled ? 'block' : 'none';
    this.game.style.display = 'none';
    this.banner.style.display = 'none';
    this.skip.style.display = 'none';
    this.overlay.style.display = 'none';
    this.renderLegend();
  }

  /** Only touch the DOM when a value changed. */
  private set(key: string, value: string, apply: (v: string) => void): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply(value);
  }

  setDevice(d: Device): void {
    this.device = d;
    this.renderLegend();
    this.cache.delete('tuto');
    this.cache.delete('toolkeys');
    if (this.lastGame) this.setGame(this.lastGame);
    if (this.lastHud) this.setHud(this.lastHud);
    if (this.menu) this.refreshMenuLabels();
  }

  private renderLegend(): void {
    this.legend.textContent = '';
    const rows: Array<[Parameters<typeof glyph>[0], StringKey]> = [
      ['grab', 'help.grab'],
      ['tool', 'help.tool'],
      ['swap', 'help.swap'],
      ['tilt', 'help.tilt'],
    ];
    for (const [a, k] of rows) {
      const row = el('div', 'legend-row', this.legend);
      el('span', 'chip', row, glyph(a, this.device));
      el('span', '', row, t(k));
    }
  }

  setHud(h: HudState): void {
    this.lastHud = h;
    this.set('tool', `${h.tool}|${this.device}`, () => {
      this.toolIcon.textContent = h.tool === 'cleaver' ? '🔪' : '🔥';
      this.toolName.textContent = t(h.tool === 'cleaver' ? 'tool.cleaver' : 'tool.torch');
    });
    this.set('toolkeys', `${h.tool}|${h.tilt}|${this.device}`, () => {
      this.toolKeys.textContent = '';
      el('span', 'chip', this.toolKeys, glyph('swap', this.device));
      if (h.tool === 'cleaver') {
        el('span', 'chip', this.toolKeys, glyph('tilt', this.device));
        el('span', 'angle', this.toolKeys, (['│', '╱', '─'] as const)[h.tilt]);
      }
    });
  }

  /** Called ~10 Hz with the sim's game state. */
  setGame(g: GameHud): void {
    this.lastGame = g;
    const inPlay = g.phase === 'tutorial' || g.phase === 'service';
    this.game.style.display = inPlay ? 'block' : 'none';
    const tut = g.phase === 'tutorial';
    this.banner.style.display = tut ? 'block' : 'none';
    this.skip.style.display = tut ? 'flex' : 'none';
    this.centerTop.style.display = g.phase === 'service' ? 'block' : 'none';
    this.bellyCard.style.display = g.phase === 'service' ? 'flex' : 'none';

    this.set('craving', g.cravingId, () => {
      this.cravingIcon.textContent = CRAVING_ICON[g.cravingId] ?? '🍽️';
      this.cravingText.textContent = cravingName(g.cravingId);
      this.cravingCard.classList.remove('pop');
      void this.cravingCard.offsetWidth;
      this.cravingCard.classList.add('pop');
    });
    const frac = g.cravingWindow > 0 ? g.cravingTimeLeft / g.cravingWindow : 1;
    this.cravingBar.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    this.cravingBar.style.background = frac < 0.25 ? '#e4572e' : frac < 0.5 ? '#f4a259' : '#6fd36f';

    if (g.phase === 'service') {
      this.set('timer', fmtTime(g.timeLeft), (v) => (this.timer.textContent = v));
      this.timer.classList.toggle('low', g.timeLeft <= 10);
      this.set('score', String(g.score), () => (this.scoreEl.textContent = t('score.pts', { n: g.score })));
      this.bellyFace.textContent = BELLY_FACE[g.band];
      this.bellyBar.style.width = `${Math.max(0, Math.min(100, g.belly))}%`;
      this.bellyBar.style.background = BELLY_COLOR[g.band];
      this.bellyCard.classList.toggle('hangry', g.band === 3);
      this.set('hearts', String(g.patience), () => {
        this.bellyHearts.textContent = '';
        for (let i = 0; i < 3; i++) el('span', i < g.patience ? 'heart' : 'heart lost', this.bellyHearts, i < g.patience ? '❤️' : '🖤');
      });
    }

    if (tut) {
      const step = Math.max(0, Math.min(4, g.tutorialStep));
      this.set('tuto', `${step}|${this.device}`, () => {
        this.bannerStep.textContent = step < 4 ? t('tuto.step', { n: step + 1 }) : '';
        this.bannerTitle.textContent = t(`tuto.${step}` as StringKey);
        const hint = t(`tuto.${step}.hint` as StringKey, { grab: glyph('grab', this.device) });
        this.bannerHint.textContent = hint;
        this.bannerHint.style.display = hint ? 'block' : 'none';
        this.banner.classList.remove('pop');
        void this.banner.offsetWidth;
        this.banner.classList.add('pop');
        this.skipText.textContent = t('tuto.skip', { skip: glyph('skip', this.device) });
      });
    }
  }

  setSkipProgress(p: number): void {
    this.skipBar.style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
  }

  /** Floating context prompt at screen position (px) or hidden when `kind` is null. */
  setPrompt(sx: number, sy: number, kind: 'take' | 'place' | 'serve' | null): void {
    if (!kind) {
      this.prompt.style.opacity = '0';
      return;
    }
    this.set('prompt', `${kind}|${this.device}`, () => {
      this.prompt.textContent = '';
      el('span', 'chip', this.prompt, glyph('grab', this.device));
      el('span', '', this.prompt, t(`prompt.${kind}` as StringKey));
    });
    this.prompt.style.opacity = '1';
    this.prompt.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
  }

  showServe(tier: DishTier, cravingId: string, score: number, points: number, timeBonus: number, highlights: string[]): void {
    const color = TIER_COLOR[tier] ?? '#fff';
    this.serve.textContent = '';
    const top = el('div', 'serve-top', this.serve);
    el('span', 'serve-tier', top, t(`tier.${tier}` as StringKey)).style.color = color;
    if (points > 0) el('span', 'serve-points', top, `+${points}`).style.color = color;
    el('div', 'serve-craving', this.serve, `${cravingName(cravingId)} · ${score}/100`);
    const chips = el('div', 'serve-chips', this.serve);
    if (timeBonus > 0) el('span', 'chip-soft', chips, t('serve.bonus', { n: timeBonus }));
    for (const h of highlights) el('span', 'chip-soft', chips, t(`hl.${h}` as StringKey));
    this.serve.classList.remove('show');
    void this.serve.offsetWidth;
    this.serve.classList.add('show');
    window.clearTimeout(this.serveTimer);
    this.serveTimer = window.setTimeout(() => this.serve.classList.remove('show'), 3200);
  }

  say(text: string): void {
    this.toast.textContent = text;
    this.toast.style.opacity = '1';
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast.style.opacity = '0'), 2200);
  }

  // ------------------------------------------------------------------ menus

  get menuId(): MenuSpec['id'] | null {
    return this.menu?.id ?? null;
  }

  openMenu(spec: MenuSpec, guardMs = 350): void {
    this.menu = spec;
    this.menuReadyAt = performance.now() + guardMs;
    this.overlay.textContent = '';
    this.overlay.style.display = 'flex';
    const card = el('div', `menu-card menu-${spec.id}`, this.overlay);
    el('h1', 'menu-title', card, spec.title);
    if (spec.subtitle) el('p', 'menu-sub', card, spec.subtitle);
    spec.body?.(card);
    const list = el('div', 'menu-buttons', card);
    this.menuButtons = spec.buttons.map((b, i) => {
      const btn = el('button', 'menu-btn', list, b.label());
      btn.type = 'button';
      btn.addEventListener('mouseenter', () => this.focusMenu(i));
      btn.addEventListener('click', () => {
        if (performance.now() >= this.menuReadyAt) b.onSelect();
      });
      return btn;
    });
    this.menuHint = el('div', 'menu-hint', card, t(this.device === 'gamepad' ? 'hint.menu.pad' : 'hint.menu.kb'));
    this.focusMenu(0);
    this.game.style.opacity = spec.id === 'pause' ? '0.35' : '1';
  }

  closeMenu(): void {
    this.menu = null;
    this.menuButtons = [];
    this.overlay.style.display = 'none';
    this.overlay.textContent = '';
    this.game.style.opacity = '1';
  }

  private refreshMenuLabels(): void {
    if (this.menuHint) this.menuHint.textContent = t(this.device === 'gamepad' ? 'hint.menu.pad' : 'hint.menu.kb');
    this.menu?.buttons.forEach((b, i) => {
      if (this.menuButtons[i]) this.menuButtons[i]!.textContent = b.label();
    });
  }

  private focusMenu(i: number): void {
    this.menuFocus = (i + this.menuButtons.length) % this.menuButtons.length;
    this.menuButtons.forEach((b, k) => b.classList.toggle('focused', k === this.menuFocus));
    this.menuButtons[this.menuFocus]?.focus({ preventScroll: true });
  }

  /** Gamepad / keyboard navigation of the open menu. */
  menuNav(cmd: MenuCommand): void {
    if (!this.menu || this.menuButtons.length === 0) return;
    if (cmd === 'up' || cmd === 'left') this.focusMenu(this.menuFocus - 1);
    else if (cmd === 'down' || cmd === 'right') this.focusMenu(this.menuFocus + 1);
    else if (cmd === 'accept' && performance.now() >= this.menuReadyAt) this.menu.buttons[this.menuFocus]?.onSelect();
  }

  /** Re-render labels (e.g. the sound toggle) of the open menu. */
  refreshMenu(): void {
    this.refreshMenuLabels();
  }
}

