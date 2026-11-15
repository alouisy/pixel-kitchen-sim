import { cravings } from '@ga/content';
import { RECIPES, type DishTier, type HudState, type InteractHint, type ServeProblemLite } from '@ga/sim';
import {
  CRAVING_TEXT,
  HIGHLIGHT_TEXT,
  T,
  TIER_COLOR,
  TIER_TEXT,
  TILT_ICON,
  TILT_TEXT,
  TOOL_ICON,
  TOOL_TEXT,
  ingIcon,
  ingName,
  recipeIcon,
  recipeName,
} from './strings.js';

const PROMPT_KEY = new Map(cravings.map((c) => [c.id, c.prompt]));
const promptText = (id: string): string => CRAVING_TEXT[PROMPT_KEY.get(id) ?? ''] ?? id;
const BEST_KEY = 'ga.v2.rush.best';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function readBest(): number {
  const v = Number(localStorage.getItem(BEST_KEY) ?? '0');
  return Number.isFinite(v) ? v : 0;
}

interface EndStats {
  score: number;
  served: number;
  missed: number;
  stars: number;
  best: number;
  isBest: boolean;
}

/** DOM HUD: rush tickets / timer / score, contextual interact hint, title + results screens, toasts, help, debug. */
export class Hud {
  private readonly root = el('div', 'hud', document.body);
  private readonly tool: HTMLDivElement;
  private readonly craving: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly top = el('div', 'hud-top', document.body);
  private readonly tickets = el('div', 'hud-tickets', document.body);
  private readonly hintBar = el('div', 'hud-hint', document.body);
  private readonly toasts = el('div', 'hud-toasts', document.body);
  private readonly help: HTMLDivElement;
  private readonly screen = el('div', 'hud-screen', document.body);
  readonly debug: HTMLPreElement;
  private cardTimer = 0;
  private helpVisible = true;
  private lastKey = '';
  private lastScreenKey = '';
  private lastTicketsKey = '';
  private lastPhase = -1;
  private gamepad = false;
  private lastEnd: EndStats | null = null;

  constructor(
    debugEnabled: boolean,
    private readonly rush: boolean,
  ) {
    this.tool = el('div', 'hud-row hud-tool', this.root);
    this.craving = el('div', 'hud-row hud-craving', this.root);
    this.card = el('div', 'hud-card', this.root);
    if (rush) {
      this.craving.style.display = 'none';
      this.root.classList.add('hud-rush');
    }
    this.help = el('div', 'hud-help', document.body);
    el('div', 'hud-help-title', this.help, `${T.help} (H)`);
    for (const [k, v] of T.helpLines) {
      const row = el('div', 'hud-help-row', this.help);
      el('kbd', '', row, k);
      el('span', '', row, v);
    }
    this.debug = el('pre', 'hud-debug', document.body);
    this.debug.style.display = debugEnabled ? 'block' : 'none';
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && !e.repeat) this.setHelp(!this.helpVisible);
    });
    if (!rush) window.setTimeout(() => this.setHelp(false), 20000);
  }

  setGamepad(v: boolean): void {
    if (v === this.gamepad) return;
    this.gamepad = v;
    this.lastKey = '';
    this.lastScreenKey = '';
  }

  private get interactKey(): string {
    return this.gamepad ? 'Ⓐ' : 'E';
  }

  private setHelp(v: boolean): void {
    this.helpVisible = v;
    this.help.style.opacity = v ? '1' : '0';
  }

  setHud(h: HudState): void {
    if (this.rush) this.setRush(h);
    const key = `${h.tool}|${h.tilt}|${h.cravingId}|${h.heldId}|${JSON.stringify(h.hint)}|${this.gamepad}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.tool.textContent = '';
    el('b', '', this.tool, `${TOOL_ICON[h.tool]} ${TOOL_TEXT[h.tool]}`);
    if (h.tool === 'cleaver') el('span', 'hud-sub', this.tool, `${TILT_ICON[h.tilt]} ${TILT_TEXT[h.tilt] ?? ''}`);
    el('span', 'hud-label', this.tool, this.gamepad ? 'Y / X' : 'Tab / R');
    this.craving.textContent = '';
    el('span', 'hud-label', this.craving, 'Craving');
    el('span', '', this.craving, promptText(h.cravingId));
    this.renderHint(h.hint, h.tool);
  }

  private renderHint(hint: InteractHint, tool: 'cleaver' | 'torch'): void {
    this.hintBar.textContent = '';
    const add = (key: string, text: string, dim = false): void => {
      const row = el('span', `hud-hint-item${dim ? ' dim' : ''}`, this.hintBar);
      el('kbd', '', row, key);
      el('span', '', row, text);
    };
    const H = T.hint;
    switch (hint.kind) {
      case 'start':
        add(this.interactKey, H.start);
        break;
      case 'restart':
        if (hint.ready) add(this.interactKey, H.restart);
        break;
      case 'spawn':
        add(this.interactKey, H.spawn(`${ingIcon(hint.material)} ${ingName(hint.material)}`));
        break;
      case 'grab':
        add(this.interactKey, H.grab(`${ingIcon(hint.material)} ${ingName(hint.material)}`, hint.pieces));
        add(this.gamepad ? 'RT' : '🖱', tool === 'cleaver' ? H.cut : H.heat, true);
        break;
      case 'too_heavy':
        add('✋', H.too_heavy, true);
        break;
      case 'place':
        add(this.interactKey, H.place[hint.on]);
        break;
      case 'serve':
        add(this.interactKey, H.serve);
        break;
      case 'taste':
        add(this.interactKey, H.taste);
        break;
      default:
        break;
    }
    this.hintBar.style.opacity = this.hintBar.childElementCount > 0 ? '1' : '0';
  }

  private setRush(h: HudState): void {
    this.top.textContent = '';
    if (h.phase === 1) {
      el('div', `hud-timer${h.timeLeftS <= 20 ? ' urgent' : ''}`, this.top, `⏱ ${fmtTime(h.timeLeftS)}`);
      el('div', 'hud-scorebox', this.top, `${T.score} ${h.score}`);
      el('div', 'hud-servedbox', this.top, `✅ ${h.served}   ❌ ${h.missed}`);
    }
    const tkey = JSON.stringify(h.orders.map((o) => [o.uid, Math.floor(o.left * 60)])) + h.phase;
    if (tkey !== this.lastTicketsKey) {
      this.lastTicketsKey = tkey;
      this.tickets.textContent = '';
      if (h.phase === 1)
        for (const o of h.orders) {
          const r = RECIPES.find((x) => x.id === o.recipeId);
          const card = el('div', `ticket${o.left < 0.25 ? ' late' : ''}`, this.tickets);
          el('div', 'ticket-title', card, `${recipeIcon(o.recipeId)} ${recipeName(o.recipeId)}`);
          const ings = el('div', 'ticket-ings', card);
          for (const ing of r?.ingredients ?? []) {
            const chip = el('div', 'ticket-ing', ings);
            el('span', 'ticket-ing-icon', chip, ingIcon(ing.id));
            const tags: string[] = [];
            if (ing.pieces) tags.push(`🔪×${ing.pieces}`);
            if (ing.cooked) tags.push('🔥');
            el('span', 'ticket-ing-tags', chip, tags.join(' '));
          }
          const bar = el('div', 'ticket-bar', card);
          const fill = el('div', 'ticket-bar-fill', bar);
          fill.style.width = `${Math.round(o.left * 100)}%`;
          fill.style.background = o.left > 0.5 ? '#6fd36f' : o.left > 0.25 ? '#f4a259' : '#e4572e';
          el('div', 'ticket-points', card, `${r?.points ?? 0} pts`);
        }
    }
    if (h.phase !== this.lastPhase) {
      if (h.phase === 1 && this.lastPhase !== -1) this.setHelp(false);
      this.lastPhase = h.phase;
    }
    const ready = h.hint.kind === 'restart' ? h.hint.ready : true;
    const skey = `${h.phase}|${ready}|${this.gamepad}`;
    if (skey === this.lastScreenKey) return;
    this.lastScreenKey = skey;
    this.screen.textContent = '';
    this.screen.style.display = h.phase === 1 ? 'none' : 'flex';
    if (h.phase === 0) this.titleScreen();
    else if (h.phase === 2) this.resultsScreen(ready);
  }

  private titleScreen(): void {
    const box = el('div', 'screen-box', this.screen);
    el('div', 'screen-title', box, T.title);
    el('div', 'screen-sub', box, T.subtitle);
    el('div', 'screen-goal', box, T.goal);
    const steps = el('ol', 'screen-steps', box);
    for (const [icon, text] of T.steps) {
      const li = el('li', '', steps);
      el('span', 'screen-step-icon', li, icon);
      el('span', '', li, text);
    }
    const menu = el('div', 'screen-menu', box);
    for (const r of RECIPES) {
      const row = el('div', 'screen-menu-row', menu);
      el('span', 'screen-menu-name', row, `${recipeIcon(r.id)} ${recipeName(r.id)}`);
      el(
        'span',
        'screen-menu-ings',
        row,
        r.ingredients.map((i) => `${ingIcon(i.id)}${i.pieces ? ` 🔪×${i.pieces}` : ''}${i.cooked ? ' 🔥' : ''}`).join('  +  '),
      );
    }
    el('div', 'screen-tip', box, T.tip);
    const best = readBest();
    if (best > 0) el('div', 'screen-best', box, `🏆 ${T.best} : ${best}`);
    const go = el('div', 'screen-go', box);
    el('kbd', '', go, this.interactKey);
    el('span', '', go, ` ${T.start}`);
  }

  private resultsScreen(ready: boolean): void {
    const box = el('div', 'screen-box', this.screen);
    el('div', 'screen-title', box, T.over);
    const e = this.lastEnd;
    if (e) {
      el('div', 'screen-stars', box, '★'.repeat(e.stars) + '☆'.repeat(3 - e.stars));
      el('div', 'screen-score', box, String(e.score));
      if (e.isBest) el('div', 'screen-newbest', box, `🏆 ${T.newBest}`);
      else el('div', 'screen-best', box, `🏆 ${T.best} : ${e.best}`);
      el('div', 'screen-goal', box, `✅ ${T.served} : ${e.served}     ❌ ${T.missed} : ${e.missed}`);
    }
    const go = el('div', 'screen-go', box);
    if (ready) {
      el('kbd', '', go, this.interactKey);
      el('span', '', go, ` ${T.again}`);
    } else el('span', '', go, T.wait);
  }

  serviceEnded(score: number, served: number, missed: number, stars: number): void {
    const prev = readBest();
    const isBest = score > prev;
    if (isBest) localStorage.setItem(BEST_KEY, String(score));
    this.lastEnd = { score, served, missed, stars, best: Math.max(prev, score), isBest };
    this.lastScreenKey = '';
  }

  showResult(cravingId: string, score: number, tier: DishTier, highlights: string[]): void {
    this.card.textContent = '';
    const color = TIER_COLOR[tier] ?? '#fff';
    el('div', 'hud-card-title', this.card, promptText(cravingId));
    const top = el('div', 'hud-card-top', this.card);
    el('span', 'hud-score', top, String(score)).style.color = color;
    el('span', 'hud-tier', top, TIER_TEXT[tier] ?? tier).style.color = color;
    const chips = el('div', 'hud-chips', this.card);
    for (const h of highlights) el('span', 'hud-chip', chips, HIGHLIGHT_TEXT[h] ?? h);
    this.card.style.opacity = '1';
    window.clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => (this.card.style.opacity = '0'), 6000);
  }

  problemText(recipeId: string, p: ServeProblemLite): string {
    if (p.kind === 'no_order') return T.noOrder;
    const r = recipeName(recipeId);
    const i = p.kind === 'burnt' && p.id === 'ash' ? ingName('ash') : `${ingIcon(p.id)} ${ingName(p.id)}`;
    if (p.kind === 'not_cut') return T.problem.not_cut(i, r, p.pieces ?? 0, p.need ?? 0);
    return T.problem[p.kind](i, r);
  }

  /** Stacked toasts; `tone` colours the border. */
  say(text: string, tone: 'good' | 'bad' | 'info' = 'info'): void {
    const t = el('div', `hud-toast ${tone}`, this.toasts, text);
    while (this.toasts.childElementCount > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => t.classList.add('out'), 2600);
    window.setTimeout(() => t.remove(), 3200);
  }
}
