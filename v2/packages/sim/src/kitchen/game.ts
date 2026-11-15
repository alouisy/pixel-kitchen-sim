import { Prng, SIM_DT } from '@ga/shared';
import { cravings, gameTuning as T, type Craving } from '@ga/content';
import { firstMaterial, doneGauge, type FoodBody } from '../food/index.js';
import { MUSHROOM_INDEX } from '../food/materialTable.js';
import type { DishTier, EndReason, Phase, SimEvent } from '../types.js';
import type { KitchenSim } from './play.js';

export const PHASES: readonly Phase[] = ['title', 'tutorial', 'service', 'results'];
const TIERS: readonly DishTier[] = ['yuck', 'okay', 'great', 'perfect'];
const END_REASONS: readonly (EndReason | '')[] = ['', 'time', 'patience'];

/** Index map of the flat Float64 state vector (hashed, snapshotted and restored verbatim). */
export const G = {
  PHASE: 0,
  TUT_STEP: 1,
  TUT_TIMER: 2,
  TICKS_LEFT: 3,
  BELLY: 4,
  MOOD: 5,
  PATIENCE: 6,
  CRAV_POS: 7,
  CRAV_TIME: 8,
  HANGRY: 9,
  SCORE: 10,
  SERVED: 11,
  BEST_SCORE: 12,
  BEST_CRAV: 13,
  BEST_TIER: 14,
  END_REASON: 15,
  ORDER: 16, // up to 8 craving indices
  N: 24,
} as const;
const MAX_ORDER = 8;

export const TUTORIAL_STEPS = 5;
export const SERVICE_TICKS = Math.round(T.serviceSeconds / SIM_DT);
const TUT_DONE_TICKS = Math.round(T.tutorial.doneSeconds / SIM_DT);

export function bellyBand(belly: number): 0 | 1 | 2 | 3 {
  return belly >= T.belly.bandContent ? 0 : belly >= T.belly.bandPeckish ? 1 : belly >= T.belly.bandHungry ? 2 : 3;
}

export function starsFor(score: number): 0 | 1 | 2 | 3 {
  return score >= T.stars[2] ? 3 : score >= T.stars[1] ? 2 : score >= T.stars[0] ? 1 : 0;
}

export interface ServeOutcome {
  points: number;
  timeBonus: number;
  bellyGain: number;
}

/** Game-flow state machine: title -> tutorial -> service -> results (docs/v2/03 §3). Pure and deterministic. */
export class Game {
  readonly f = new Float64Array(G.N);

  constructor(public rng: Prng) {
    this.begin('title');
  }

  get phase(): Phase {
    return PHASES[this.f[G.PHASE]!]!;
  }
  get tutorialStep(): number {
    return this.phase === 'tutorial' ? this.f[G.TUT_STEP]! : -1;
  }
  get belly(): number {
    return this.f[G.BELLY]!;
  }
  get mood(): number {
    return this.f[G.MOOD]!;
  }
  get patience(): number {
    return this.f[G.PATIENCE]!;
  }
  get score(): number {
    return this.f[G.SCORE]!;
  }
  get served(): number {
    return this.f[G.SERVED]!;
  }
  get timeLeft(): number {
    return this.f[G.TICKS_LEFT]! * SIM_DT;
  }
  get cravingTimeLeft(): number {
    return this.f[G.CRAV_TIME]!;
  }
  get endReason(): EndReason | '' {
    return END_REASONS[this.f[G.END_REASON]!]!;
  }
  get bestDish(): { score: number; cravingId: string; tier: DishTier | '' } {
    const c = this.f[G.BEST_CRAV]!;
    const t = this.f[G.BEST_TIER]!;
    return {
      score: this.f[G.BEST_SCORE]!,
      cravingId: c >= 0 ? cravings[c]!.id : '',
      tier: t >= 0 ? TIERS[t]! : '',
    };
  }

  craving(): Craving {
    return cravings[this.cravingIndex()]!;
  }
  cravingIndex(): number {
    if (this.phase !== 'service') return 0; // tutorial/title/results: always the seared mushroom
    return this.f[G.ORDER + this.f[G.CRAV_POS]!]!;
  }

  /** Reset every field for `phase` (title, tutorial or service). Re-shuffles the craving order. */
  begin(phase: Phase): void {
    const f = this.f;
    f.fill(0);
    f[G.PHASE] = PHASES.indexOf(phase);
    f[G.BELLY] = T.belly.start;
    f[G.PATIENCE] = T.patience;
    f[G.TICKS_LEFT] = SERVICE_TICKS;
    f[G.BEST_CRAV] = -1;
    f[G.BEST_TIER] = -1;
    this.shuffle();
    f[G.CRAV_TIME] = this.craving().window;
  }

  private shuffle(): void {
    const n = Math.min(MAX_ORDER, cravings.length);
    const f = this.f;
    const last = f[G.ORDER + n - 1]!;
    for (let i = 0; i < n; i++) f[G.ORDER + i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      const t = f[G.ORDER + i]!;
      f[G.ORDER + i] = f[G.ORDER + j]!;
      f[G.ORDER + j] = t;
    }
    // Avoid the same craving twice in a row across a reshuffle.
    if (n > 1 && f[G.ORDER]! === last && this.f[G.SERVED]! + this.f[G.CRAV_POS]! > 0) {
      const t = f[G.ORDER]!;
      f[G.ORDER] = f[G.ORDER + 1]!;
      f[G.ORDER + 1] = t;
    }
  }

  private advanceCraving(events: SimEvent[]): void {
    const f = this.f;
    f[G.CRAV_POS] = f[G.CRAV_POS]! + 1;
    if (f[G.CRAV_POS]! >= Math.min(MAX_ORDER, cravings.length)) {
      this.shuffle();
      f[G.CRAV_POS] = 0;
    }
    const c = this.craving();
    f[G.CRAV_TIME] = c.window;
    events.push({ kind: 'CravingChanged', cravingId: c.id });
  }

  private setTutorialStep(step: number, events: SimEvent[]): void {
    this.f[G.TUT_STEP] = step;
    this.f[G.TUT_TIMER] = 0;
    events.push({ kind: 'TutorialStep', step });
    if (step === TUTORIAL_STEPS - 1) events.push({ kind: 'TutorialDone' });
  }

  private end(reason: EndReason, events: SimEvent[]): void {
    this.f[G.PHASE] = PHASES.indexOf('results');
    this.f[G.END_REASON] = END_REASONS.indexOf(reason);
    events.push({ kind: 'PhaseChanged', phase: 'results' });
    events.push({ kind: 'ServiceEnded', reason, score: this.score, served: this.served });
  }

  /** Called when a chef serves food. `edibleCells` counts edible, non-ash cells served. */
  onServe(score: number, tier: DishTier, edibleCells: number, events: SimEvent[]): ServeOutcome {
    const f = this.f;
    const none: ServeOutcome = { points: 0, timeBonus: 0, bellyGain: 0 };
    if (this.phase === 'tutorial') {
      if (f[G.TUT_STEP] === 3) this.setTutorialStep(4, events);
      return none;
    }
    if (this.phase !== 'service') return none;
    const gain = Math.min(T.belly.maxRefill, edibleCells / T.belly.cellsPerBelly) * (0.5 + score / 100);
    const bellyGain = edibleCells > 0 ? gain : 0;
    f[G.BELLY] = Math.min(100, f[G.BELLY]! + bellyGain);
    if (f[G.BELLY]! >= T.belly.bandHungry) f[G.HANGRY] = 0;
    const timeBonus = Math.min(T.timeBonusCap, Math.floor(f[G.CRAV_TIME]!));
    const points = Math.round(score * (1 + f[G.MOOD]! / 200)) + timeBonus;
    f[G.SCORE] = f[G.SCORE]! + points;
    f[G.SERVED] = f[G.SERVED]! + 1;
    f[G.MOOD] = clampMood(f[G.MOOD]! + T.mood[tier]);
    if (score > f[G.BEST_SCORE]! || f[G.BEST_CRAV]! < 0) {
      f[G.BEST_SCORE] = score;
      f[G.BEST_CRAV] = this.cravingIndex();
      f[G.BEST_TIER] = TIERS.indexOf(tier);
    }
    this.advanceCraving(events);
    return { points, timeBonus, bellyGain };
  }

  /** One sim tick. Returns 'startService' when the tutorial's closing message has been shown long enough. */
  update(k: KitchenSim, events: SimEvent[]): 'startService' | null {
    const f = this.f;
    if (this.phase === 'tutorial') return this.updateTutorial(k, events);
    if (this.phase !== 'service') return null;

    f[G.TICKS_LEFT] = f[G.TICKS_LEFT]! - 1;
    f[G.BELLY] = Math.max(0, f[G.BELLY]! - T.belly.drainPerSecond * SIM_DT);
    f[G.CRAV_TIME] = f[G.CRAV_TIME]! - SIM_DT;
    if (f[G.CRAV_TIME]! <= 0) {
      events.push({ kind: 'CravingExpired', cravingId: this.craving().id });
      f[G.MOOD] = clampMood(f[G.MOOD]! + T.mood.expire);
      this.advanceCraving(events);
    }
    if (f[G.BELLY]! >= T.belly.bandHungry) f[G.HANGRY] = 0;
    else if (f[G.HANGRY] === 0) {
      f[G.HANGRY] = 1;
      f[G.PATIENCE] = f[G.PATIENCE]! - 1;
      f[G.MOOD] = clampMood(f[G.MOOD]! + T.mood.hangry);
      events.push({ kind: 'HangryEntered', patience: f[G.PATIENCE]! });
    }
    if (f[G.PATIENCE]! <= 0) this.end('patience', events);
    else if (f[G.TICKS_LEFT]! <= 0) this.end('time', events);
    return null;
  }

  private updateTutorial(k: KitchenSim, events: SimEvent[]): 'startService' | null {
    const f = this.f;
    const step = f[G.TUT_STEP]!;
    const held = k.heldBodies(0).some((b) => firstMaterial(b) === MUSHROOM_INDEX);
    let anyMushroom = held;
    let onRock: FoodBody | undefined;
    for (const id of k.store.ids()) {
      const b = k.store.get(id)!;
      if (firstMaterial(b) !== MUSHROOM_INDEX) continue;
      anyMushroom = true;
      if (!(b.flags & 4) && k.onRock(b)) onRock = b;
    }
    switch (step) {
      case 0:
        if (held) this.setTutorialStep(1, events);
        break;
      case 1:
        if (onRock) this.setTutorialStep(2, events);
        else if (!held) this.setTutorialStep(0, events);
        break;
      case 2: {
        if (!onRock) {
          this.setTutorialStep(held ? 1 : 0, events);
          break;
        }
        const g = doneGauge(onRock);
        if (g.marker >= g.perfectLo && g.marker <= g.perfectHi) this.setTutorialStep(3, events);
        break;
      }
      case 3:
        // Served in onServe. If the mushroom is gone (eaten raw by accident...), start over.
        if (!anyMushroom) this.setTutorialStep(0, events);
        break;
      default:
        f[G.TUT_TIMER] = f[G.TUT_TIMER]! + 1;
        if (f[G.TUT_TIMER]! >= TUT_DONE_TICKS) return 'startService';
    }
    return null;
  }
}

function clampMood(v: number): number {
  return v < -100 ? -100 : v > 100 ? 100 : v;
}
