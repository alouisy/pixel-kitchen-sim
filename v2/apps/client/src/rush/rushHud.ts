import type { RushView, ItemView, TicketView } from '@ga/sim';
import type { VoxModel } from '@ga/render';
import { glyph, t, type Device, type StringKey } from '../strings.js';
import type { MenuCmd } from './rushInput.js';
import { voxIcon } from './voxIcon.js';
import './rush.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

export const fmtClock = (ticks: number): string => {
  const s = Math.max(0, Math.ceil(ticks / 30));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export interface MenuItem {
  title: () => string;
  sub?: () => string;
  onSelect: () => void;
  card?: boolean;
}
export interface MenuSpec {
  id: string;
  title: () => string;
  subtitle?: () => string;
  wide?: boolean;
  body?: (card: HTMLElement) => void;
  items: MenuItem[];
  hint?: boolean;
  guardMs?: number;
}

export class RushHud {
  private readonly root = el('div', 'rh', document.body);
  private readonly tickets = el('div', 'rh-tickets', this.root);
  private readonly top = el('div', 'rh-top', this.root);
  private readonly clock = el('div', 'rh-clock', this.top);
  private readonly scoreEl = el('div', 'rh-score', this.top);
  private readonly streakEl = el('div', 'rh-streak', this.top);
  private readonly center = el('div', 'rh-center rh-hide', this.root);
  private readonly layer = el('div', 'rh-layer', this.root);
  private readonly legend = el('div', 'rh-legend', this.root);
  private readonly toastEl = el('div', 'rh-toast', this.root);
  private readonly flash = el('div', 'rh-flash', this.root);
  private readonly overlay = el('div', 'rm', this.root);
  readonly debug = el('pre', 'hud-debug', document.body);

  private device: Device = 'keyboard';
  private readonly ticketEls = new Map<number, { root: HTMLElement; bar: HTMLElement }>();
  private readonly prompts = new Map<number, { root: HTMLElement; verb: string; key: string }>();
  private readonly rings = new Map<number, { root: HTMLElement; fg: SVGCircleElement }>();
  private readonly bars = new Map<number, { root: HTMLElement; fill: HTMLElement }>();
  private viteBubble: HTMLElement | null = null;
  private shownScore = 0;
  private lastScore = 0;
  private lastStreakKey = '';
  private lastClock = '';
  private lastCountdown = -1;
  private toastTimer = 0;
  private menu: MenuSpec | null = null;
  private buttons: HTMLButtonElement[] = [];
  private focus = 0;
  private readyAt = 0;
  private hintEl: HTMLElement | null = null;
  private lastLegend = '';

  constructor(
    private readonly models: Record<string, VoxModel>,
    debug: boolean,
  ) {
    this.debug.style.display = debug ? 'block' : 'none';
    this.overlay.style.display = 'none';
    this.setPlaying(false);
    this.renderLegend();
  }

  setDevice(d: Device): void {
    if (d === this.device) return;
    this.device = d;
    this.renderLegend();
    this.refreshMenu();
  }

  get dev(): Device {
    return this.device;
  }

  /** Show or hide the in-game HUD (tickets, clock, rings). */
  setPlaying(on: boolean): void {
    for (const e of [this.tickets, this.top, this.layer, this.legend]) e.classList.toggle('rh-hide', !on);
  }

  private renderLegend(): void {
    const sig = this.device;
    if (sig === this.lastLegend) return;
    this.lastLegend = sig;
    this.legend.textContent = '';
    const rows: Array<[string, StringKey]> = [
      [glyph('grab', this.device), 'help.grab'],
      [this.device === 'gamepad' ? 'Ⓧ' : 'E', 'help.chop'],
      [glyph('dash', this.device), 'help.dash'],
    ];
    for (const [g, k] of rows) {
      const row = el('div', '', this.legend);
      el('span', 'rchip', row, g);
      el('span', '', row, t(k));
    }
    if (this.device === 'keyboard') el('div', '', this.legend, t('help.walk'));
  }

  // ------------------------------------------------------------------ per-frame

  update(v: RushView, dt: number): void {
    // Clock and score.
    const clock = fmtClock(v.timeLeftTicks);
    if (clock !== this.lastClock) {
      this.lastClock = clock;
      this.clock.textContent = clock;
    }
    this.clock.classList.toggle('low', v.phase === 'playing' && v.timeLeftTicks <= 30 * 30);
    if (v.score !== this.lastScore) this.lastScore = v.score;
    this.shownScore += (v.score - this.shownScore) * Math.min(1, dt * 8);
    if (Math.abs(this.shownScore - v.score) < 1) this.shownScore = v.score;
    this.scoreEl.textContent = t('score.pts', { n: Math.round(this.shownScore) });
    const m = (v.multPermille / 1000).toString().replace('.', lang2() === 'fr' ? ',' : '.');
    const key = `${v.multPermille}|${v.streak}`;
    if (key !== this.lastStreakKey) {
      this.streakEl.textContent = t('hud.streak', { m });
      this.streakEl.classList.toggle('on', v.multPermille > 1000);
      this.streakEl.classList.remove('pulse');
      void this.streakEl.offsetWidth;
      this.streakEl.classList.add('pulse');
      this.lastStreakKey = key;
    }
    // Countdown.
    if (this.counting && v.phase === 'countdown' && v.countdown > 0) {
      if (v.countdown !== this.lastCountdown) {
        this.lastCountdown = v.countdown;
        this.showCenter(String(v.countdown), false);
      }
    }
    this.syncTickets(v.tickets);
  }

  showGo(): void {
    this.showCenter(t('go.text'), true);
    window.setTimeout(() => this.center.classList.add('rh-hide'), 1100);
  }

  private showCenter(text: string, go: boolean): void {
    this.center.textContent = text;
    this.center.classList.remove('rh-hide', 'pop');
    this.center.classList.toggle('go', go);
    void this.center.offsetWidth;
    this.center.classList.add('pop');
  }

  hideCenter(): void {
    this.center.classList.add('rh-hide');
    this.lastCountdown = -1;
  }

  private icon(def: string, px: number): HTMLCanvasElement | null {
    const m = this.models[`meals/${def}`] ?? this.models[`items/${def}`];
    return m ? voxIcon(m, px) : null;
  }

  private syncTickets(list: TicketView[]): void {
    const seen = new Set<number>();
    for (const tk of list) {
      seen.add(tk.id);
      let e = this.ticketEls.get(tk.id);
      if (!e) {
        const root = el('div', 'tk', this.tickets);
        const ic = this.icon(tk.recipe, 96);
        if (ic) root.appendChild(ic);
        const nm = el('div', 'nm', root, t(`recipe.${tk.recipe}` as StringKey));
        const cp = el('div', 'cp', nm.parentElement!);
        const comp = this.icon('cooked_fries', 40);
        if (comp) cp.appendChild(comp);
        const bar = el('i', '', el('div', 'tbar', root));
        e = { root, bar };
        this.ticketEls.set(tk.id, e);
      }
      const frac = Math.max(0, Math.min(1, tk.leftTicks / tk.totalTicks));
      e.bar.style.width = `${frac * 100}%`;
      e.root.classList.toggle('low', frac < 0.5 && frac >= 0.25);
      const secs = tk.leftTicks / 30;
      e.root.classList.toggle('crit', frac < 0.25 || secs <= 5);
      if (frac >= 0.25 && secs > 5) e.root.classList.remove('crit');
      if (frac < 0.5 && frac >= 0.25) e.root.classList.add('low');
      else if (frac >= 0.5) e.root.classList.remove('low');
    }
    for (const [id, e] of [...this.ticketEls]) {
      if (seen.has(id)) continue;
      this.ticketEls.delete(id);
      e.root.classList.add('gone');
      window.setTimeout(() => e.root.remove(), 650);
    }
  }

  resetTickets(): void {
    for (const e of this.ticketEls.values()) e.root.remove();
    this.ticketEls.clear();
    this.shownScore = 0;
    this.lastClock = '';
    this.lastStreakKey = '';
  }

  /** Floating prompts per chef (target verb), station rings and chop bars. `proj` converts a station index + height to screen px. */
  updateWorldUi(v: RushView, proj: (station: number, height: number) => { x: number; y: number } | null): void {
    for (const c of v.chefs) {
      let p = this.prompts.get(c.slot);
      const verbKey = c.canChop && c.verb === 'take' ? 'chop' : c.verb;
      const show = c.target >= 0 && (c.verb !== 'none' || c.canChop) && v.phase !== 'ended';
      if (!p) {
        const root = el('div', 'bubble', this.layer);
        p = { root, verb: '', key: '' };
        this.prompts.set(c.slot, p);
      }
      if (!show) {
        p.root.style.opacity = '0';
        continue;
      }
      const pos = proj(c.target, 1.85);
      if (!pos) {
        p.root.style.opacity = '0';
        continue;
      }
      const dev = c.slot === 0 ? this.device : 'gamepad';
      const key = `${verbKey}|${c.canChop}|${dev}`;
      if (key !== p.key) {
        p.key = key;
        p.root.textContent = '';
        const verbs: StringKey = `verb.${verbKey === 'none' ? 'chop' : verbKey}` as StringKey;
        el('span', 'rchip', p.root, glyph('grab', dev));
        el('span', '', p.root, t(verbs));
        if (c.canChop && c.verb === 'take') {
          // Taking is also possible: show the chop hint as the main action and keep the glyph for A as secondary.
          p.root.textContent = '';
          el('span', 'rchip', p.root, glyph('tool', dev));
          el('span', '', p.root, t('verb.chop'));
          el('span', 'rchip', p.root, glyph('grab', dev));
          el('span', '', p.root, t('verb.take'));
        }
      }
      p.root.style.opacity = '1';
      p.root.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -100%)`;
    }
    // Rings above cooking stations; chop bars above boards.
    const live = new Set<number>();
    const liveBars = new Set<number>();
    let burning = false;
    v.stations.forEach((s) => {
      const it: ItemView | null = s.item;
      if (!it) return;
      if (s.def === 'fryer' && (it.state === 'cooking' || it.state === 'cooked' || it.state === 'burning')) {
        const pos = proj(s.index, 1.95);
        if (!pos) return;
        live.add(s.index);
        let r = this.rings.get(s.index);
        if (!r) {
          const root = el('div', 'ring', this.layer);
          root.innerHTML = '<svg viewBox="0 0 54 54"><circle cx="27" cy="27" r="22" stroke="rgba(255,255,255,0.15)"/><circle class="fg" cx="27" cy="27" r="22"/></svg>';
          const fg = root.querySelector('.fg') as SVGCircleElement;
          fg.style.strokeDasharray = `${2 * Math.PI * 22}`;
          r = { root, fg };
          this.rings.set(s.index, r);
        }
        const circ = 2 * Math.PI * 22;
        // Cooking fills green; after cooking the ring drains as the burn window runs out (orange, then red).
        const frac = it.state === 'cooking' ? it.progress / 256 : 1 - it.progress / 256;
        r.fg.style.strokeDashoffset = `${circ * (1 - Math.max(0.02, Math.min(1, frac)))}`;
        r.root.classList.toggle('warn', it.state === 'cooked' && it.progress > 100);
        r.root.classList.toggle('crit', it.state === 'burning');
        if (it.state === 'burning') burning = true;
        r.root.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -100%)`;
      }
      if (s.def === 'board' && it.state === 'raw' && it.progress > 0 && it.def === 'potato') {
        const pos = proj(s.index, 1.35);
        if (!pos) return;
        liveBars.add(s.index);
        let b = this.bars.get(s.index);
        if (!b) {
          const root = el('div', 'cbar', this.layer);
          b = { root, fill: el('i', '', root) };
          this.bars.set(s.index, b);
        }
        b.fill.style.width = `${(it.progress / 256) * 100}%`;
        b.root.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -100%)`;
      }
    });
    for (const [k, r] of [...this.rings]) {
      if (live.has(k)) continue;
      r.root.remove();
      this.rings.delete(k);
    }
    for (const [k, b] of [...this.bars]) {
      if (liveBars.has(k)) continue;
      b.root.remove();
      this.bars.delete(k);
    }
    if (burning && !this.viteBubble && !this.viteShown) {
      this.viteShown = true;
      for (const s of v.stations) {
        if (s.item?.state === 'burning') {
          const pos = proj(s.index, 2.4);
          if (!pos) continue;
          const b = el('div', 'bubble vite', this.layer, t('hint.hurry'));
          b.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -100%)`;
          this.viteBubble = b;
          window.setTimeout(() => {
            b.remove();
            this.viteBubble = null;
          }, 2600);
          break;
        }
      }
    }
  }
  private viteShown = false;
  /** Only count down on screen while a run is active (not behind the title or intro). */
  counting = false;

  /** Flying score number from a screen point to the score display. */
  flyScore(text: string, from: { x: number; y: number }, bad = false): void {
    const f = el('div', bad ? 'fly bad' : 'fly', this.layer, text);
    f.style.transform = `translate(${Math.round(from.x)}px, ${Math.round(from.y)}px)`;
    const target = this.scoreEl.getBoundingClientRect();
    void f.offsetWidth;
    window.setTimeout(() => {
      f.style.transform = `translate(${Math.round(bad ? from.x : target.left + target.width / 2)}px, ${Math.round(bad ? from.y - 60 : target.top)}px) scale(0.8)`;
      f.style.opacity = '0';
    }, 30);
    window.setTimeout(() => f.remove(), 1000);
  }

  say(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.style.opacity = '0'), 1800);
  }

  redFlash(): void {
    this.flash.style.opacity = '1';
    window.setTimeout(() => (this.flash.style.opacity = '0'), 200);
  }

  // ------------------------------------------------------------------ menus

  get menuId(): string | null {
    return this.menu?.id ?? null;
  }

  openMenu(spec: MenuSpec): void {
    this.menu = spec;
    this.readyAt = performance.now() + (spec.guardMs ?? 250);
    this.overlay.textContent = '';
    this.overlay.style.display = 'flex';
    const card = el('div', `rm-card${spec.wide ? ' wide' : ''}`, this.overlay);
    el('h1', '', card, spec.title());
    if (spec.subtitle) el('p', 'sub', card, spec.subtitle());
    spec.body?.(card);
    const cards = spec.items.some((i) => i.card);
    const list = el('div', cards ? 'rm-cards' : 'rm-list', card);
    this.buttons = spec.items.map((it, i) => {
      const b = el('button', cards ? 'rm-btn rm-big' : 'rm-btn', list);
      b.type = 'button';
      this.fillButton(b, it);
      b.addEventListener('mouseenter', () => this.setFocus(i));
      b.addEventListener('click', () => {
        if (performance.now() >= this.readyAt) it.onSelect();
      });
      return b;
    });
    if (spec.hint !== false) this.hintEl = el('div', 'rm-hint', card, t(this.device === 'gamepad' ? 'hint.menu.pad' : 'hint.menu.kb'));
    this.setFocus(0);
  }

  private fillButton(b: HTMLElement, it: MenuItem): void {
    b.textContent = it.title();
    if (it.sub) el('small', '', b, it.sub());
  }

  closeMenu(): void {
    this.menu = null;
    this.buttons = [];
    this.overlay.style.display = 'none';
    this.overlay.textContent = '';
  }

  refreshMenu(): void {
    if (!this.menu) return;
    this.menu.items.forEach((it, i) => {
      const b = this.buttons[i];
      if (b) {
        b.textContent = '';
        this.fillButton(b, it);
      }
    });
    if (this.hintEl) this.hintEl.textContent = t(this.device === 'gamepad' ? 'hint.menu.pad' : 'hint.menu.kb');
  }

  private setFocus(i: number): void {
    if (this.buttons.length === 0) return;
    this.focus = (i + this.buttons.length) % this.buttons.length;
    this.buttons.forEach((b, k) => b.classList.toggle('focused', k === this.focus));
    this.buttons[this.focus]?.focus({ preventScroll: true });
  }

  menuNav(cmd: MenuCmd): void {
    if (!this.menu || this.buttons.length === 0) return;
    if (cmd === 'up' || cmd === 'left') this.setFocus(this.focus - 1);
    else if (cmd === 'down' || cmd === 'right') this.setFocus(this.focus + 1);
    else if (cmd === 'accept' && performance.now() >= this.readyAt) this.menu.items[this.focus]?.onSelect();
  }

  get overlayEl(): HTMLElement {
    return this.overlay;
  }
}

function lang2(): 'fr' | 'en' {
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
