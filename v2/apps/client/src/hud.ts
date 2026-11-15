import { cravings } from '@ga/content';
import type { DishTier, HudState } from '@ga/sim';
import {
  CRAVING_TEXT,
  HELP_LINES,
  HIGHLIGHT_TEXT,
  TIER_COLOR,
  TIER_TEXT,
  TILT_ICON,
  TILT_TEXT,
  TOOL_ICON,
  TOOL_TEXT,
} from './strings.js';

const PROMPT_KEY = new Map(cravings.map((c) => [c.id, c.prompt]));
const promptText = (id: string): string => CRAVING_TEXT[PROMPT_KEY.get(id) ?? ''] ?? id;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

/** DOM HUD: tool + cut angle, craving prompt, last tasting card, toasts, help panel, optional debug overlay. */
export class Hud {
  private readonly root = el('div', 'hud', document.body);
  private readonly tool: HTMLDivElement;
  private readonly craving: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private readonly help: HTMLDivElement;
  readonly debug: HTMLPreElement;
  private cardTimer = 0;
  private toastTimer = 0;
  private helpVisible = true;
  private lastKey = '';

  constructor(debugEnabled: boolean) {
    this.tool = el('div', 'hud-row hud-tool', this.root);
    this.craving = el('div', 'hud-row hud-craving', this.root);
    this.card = el('div', 'hud-card', this.root);
    this.toast = el('div', 'hud-toast', document.body);
    this.help = el('div', 'hud-help', document.body);
    el('div', 'hud-help-title', this.help, 'Controls');
    for (const [k, v] of HELP_LINES) {
      const row = el('div', 'hud-help-row', this.help);
      el('kbd', '', row, k);
      el('span', '', row, v);
    }
    this.debug = el('pre', 'hud-debug', document.body);
    this.debug.style.display = debugEnabled ? 'block' : 'none';
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && !e.repeat) this.setHelp(!this.helpVisible);
    });
    window.setTimeout(() => this.setHelp(false), 20000);
  }

  private setHelp(v: boolean): void {
    this.helpVisible = v;
    this.help.style.opacity = v ? '1' : '0';
  }

  setHud(h: HudState): void {
    const key = `${h.tool}|${h.tilt}|${h.cravingId}|${h.heldId}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.tool.textContent = '';
    el('span', 'hud-label', this.tool, 'Tool');
    el('b', '', this.tool, `${TOOL_ICON[h.tool]} ${TOOL_TEXT[h.tool]}`);
    if (h.tool === 'cleaver') {
      el('span', 'hud-label', this.tool, 'Cut');
      el('b', '', this.tool, `${TILT_ICON[h.tilt]} ${TILT_TEXT[h.tilt]}`);
    }
    this.craving.textContent = '';
    el('span', 'hud-label', this.craving, 'Craving');
    el('span', '', this.craving, promptText(h.cravingId));
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

  say(text: string): void {
    this.toast.textContent = text;
    this.toast.style.opacity = '1';
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast.style.opacity = '0'), 2200);
  }
}
