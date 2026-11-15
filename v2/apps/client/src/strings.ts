/** Player-facing text. French by default; English when the browser language does not start with "fr". */
export type Lang = 'fr' | 'en';

const fr = {
  'title.name': 'Le petit-déjeuner de Mossback',
  'title.tagline': "Nourris le Géant avant qu'il ne s'impatiente !",
  'btn.play': 'Jouer',
  'btn.tutorial': 'Tutoriel',
  'btn.replay': 'Rejouer',
  'btn.resume': 'Reprendre',
  'btn.restart': 'Recommencer',
  'btn.quit': 'Quitter vers le titre',
  'btn.sound.on': 'Son : activé',
  'btn.sound.off': 'Son : coupé',
  'pause.title': 'Pause',
  'hint.menu.pad': 'Ⓐ valider · croix directionnelle : choisir',
  'hint.menu.kb': 'Entrée ou clic : valider · flèches : choisir',

  'craving.label': 'Mossback veut',
  'craving.seared_mushroom': 'Un champignon bien saisi',
  'craving.crunchy_hot': 'Quelque chose de croustillant et chaud',
  'craving.tall_tower': 'Une grande tour de champignons',

  'tool.cleaver': 'Couteau',
  'tool.torch': 'Chalumeau',
  'tool.swap': '{swap} changer',
  'tool.tilt': '{tilt} angle',

  'score.pts': '{n} pts',
  'time.label': 'Temps',

  'tuto.step': 'Étape {n}/4',
  'tuto.0': 'Prends un champignon',
  'tuto.0.hint': 'Va devant le tapis du champignon, puis {grab}',
  'tuto.1': 'Pose-le sur la pierre chaude',
  'tuto.1.hint': 'Face à la pierre : {grab}',
  'tuto.2': "Attends qu'il dore… pas trop !",
  'tuto.2.hint': "Vise la zone verte de la jauge",
  'tuto.3': 'Reprends-le et donne-le à Mossback',
  'tuto.3.hint': '{grab} pour le reprendre, puis {grab} devant sa bouche',
  'tuto.4': 'Bravo ! Maintenant, une vraie partie de 3 minutes.',
  'tuto.4.hint': '',
  'tuto.skip': 'Passer le tutoriel : maintenir {skip}',

  'prompt.take': 'Prendre',
  'prompt.place': 'Poser',
  'prompt.serve': 'Servir',

  'help.grab': 'Prendre / Poser / Servir',
  'help.tool': 'Outil (maintenir)',
  'help.swap': "Changer d'outil",
  'help.tilt': 'Angle de coupe',
  'help.move': 'Bouger',
  'help.pause': 'Pause',

  'tier.perfect': 'Parfait !',
  'tier.great': 'Très bien',
  'tier.okay': 'Pas mal',
  'tier.yuck': 'Beurk',
  'serve.bonus': '+{n} bonus temps',

  'hl.TOO_SMALL': 'Trop petit',
  'hl.PERFECT_SEAR': 'Saisie parfaite',
  'hl.RAW_CENTER': 'Cœur cru',
  'hl.MOSTLY_ASH': 'Presque des cendres',
  'hl.TALL_TOWER': 'Belle tour',
  'hl.TOO_SPICY': 'Trop piquant',

  'toast.tooHeavy': 'Trop lourd à porter !',
  'toast.full': 'La cuisine est pleine (40 morceaux max).',
  'toast.tooSmall': 'Trop petit pour couper',
  'toast.hangry': 'Mossback a très faim !',
  'toast.expired': 'Trop tard ! Mossback change d’envie…',
  'toast.perfectBand': 'Doré à point !',

  'results.title': 'Service terminé',
  'results.score': 'Score',
  'results.served': 'Plats servis',
  'results.best': 'Meilleur plat',
  'results.none': 'Aucun',
  'results.record': 'Nouveau record !',
  'results.bestScore': 'Record : {n}',
  'results.time': "Le service est terminé !",
  'results.patience': 'Mossback est parti bouder…',
  'results.stars': '{n} étoiles',
} as const;

export type StringKey = keyof typeof fr;

const en: Record<StringKey, string> = {
  'title.name': "Mossback's Breakfast",
  'title.tagline': 'Feed the Giant before he loses patience!',
  'btn.play': 'Play',
  'btn.tutorial': 'Tutorial',
  'btn.replay': 'Play again',
  'btn.resume': 'Resume',
  'btn.restart': 'Restart',
  'btn.quit': 'Quit to title',
  'btn.sound.on': 'Sound: on',
  'btn.sound.off': 'Sound: off',
  'pause.title': 'Paused',
  'hint.menu.pad': 'Ⓐ confirm · d-pad: choose',
  'hint.menu.kb': 'Enter or click: confirm · arrows: choose',

  'craving.label': 'Mossback wants',
  'craving.seared_mushroom': 'A nicely seared mushroom',
  'craving.crunchy_hot': 'Something crunchy and hot',
  'craving.tall_tower': 'A tall mushroom tower',

  'tool.cleaver': 'Knife',
  'tool.torch': 'Torch',
  'tool.swap': '{swap} swap',
  'tool.tilt': '{tilt} angle',

  'score.pts': '{n} pts',
  'time.label': 'Time',

  'tuto.step': 'Step {n}/4',
  'tuto.0': 'Grab a mushroom',
  'tuto.0.hint': 'Stand in front of the mushroom mat, then {grab}',
  'tuto.1': 'Put it on the hot rock',
  'tuto.1.hint': 'Face the rock: {grab}',
  'tuto.2': "Wait until it browns… not too much!",
  'tuto.2.hint': 'Aim for the green zone of the gauge',
  'tuto.3': 'Pick it up and give it to Mossback',
  'tuto.3.hint': '{grab} to pick it up, then {grab} in front of his mouth',
  'tuto.4': 'Well done! Now a real 3-minute round.',
  'tuto.4.hint': '',
  'tuto.skip': 'Skip the tutorial: hold {skip}',

  'prompt.take': 'Take',
  'prompt.place': 'Place',
  'prompt.serve': 'Serve',

  'help.grab': 'Take / Place / Serve',
  'help.tool': 'Tool (hold)',
  'help.swap': 'Swap tool',
  'help.tilt': 'Cut angle',
  'help.move': 'Move',
  'help.pause': 'Pause',

  'tier.perfect': 'Perfect!',
  'tier.great': 'Great',
  'tier.okay': 'Okay',
  'tier.yuck': 'Yuck',
  'serve.bonus': '+{n} time bonus',

  'hl.TOO_SMALL': 'Too small',
  'hl.PERFECT_SEAR': 'Perfect sear',
  'hl.RAW_CENTER': 'Raw center',
  'hl.MOSTLY_ASH': 'Mostly ash',
  'hl.TALL_TOWER': 'Tall tower',
  'hl.TOO_SPICY': 'Too spicy',

  'toast.tooHeavy': 'Too heavy to lift!',
  'toast.full': 'The kitchen is full (40 pieces max).',
  'toast.tooSmall': 'Too small to cut',
  'toast.hangry': 'Mossback is starving!',
  'toast.expired': 'Too late! Mossback changes his mind…',
  'toast.perfectBand': 'Browned just right!',

  'results.title': 'Service over',
  'results.score': 'Score',
  'results.served': 'Dishes served',
  'results.best': 'Best dish',
  'results.none': 'None',
  'results.record': 'New record!',
  'results.bestScore': 'Best: {n}',
  'results.time': 'The service is over!',
  'results.patience': 'Mossback went off to sulk…',
  'results.stars': '{n} stars',
};

const dicts: Record<Lang, Record<StringKey, string>> = { fr, en };

export function detectLang(nav: { language?: string } = navigator): Lang {
  return (nav.language ?? 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export const lang: Lang = detectLang();

/** Look up `key` in the active language, replacing `{name}` placeholders from `vars`. */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s = dicts[lang][key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Craving prompt keys come from content JSON (`craving.*`); fall back to the raw key. */
export function cravingText(promptKey: string): string {
  return promptKey in fr ? t(promptKey as StringKey) : promptKey;
}

export const TIER_COLOR: Record<string, string> = {
  perfect: '#ffd23f',
  great: '#6fd36f',
  okay: '#f4a259',
  yuck: '#e4572e',
};

export type Device = 'gamepad' | 'keyboard';
export type Action = 'grab' | 'tool' | 'swap' | 'tilt' | 'skip' | 'pause' | 'move';

const PAD_GLYPH: Record<Action, string> = { grab: 'Ⓐ', tool: 'Ⓧ', swap: 'Ⓨ', tilt: 'RB', skip: 'Ⓑ', pause: 'Start', move: 'Stick' };
const keyLabels = { KeyQ: 'Q', KeyR: 'R' };

/** Layout-aware letters for the Q and R keys (AZERTY prints them elsewhere); falls back to the QWERTY letters. */
export function learnKeyboardLayout(): void {
  const kb = (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
  void kb?.getLayoutMap?.().then((m) => {
    keyLabels.KeyQ = (m.get('KeyQ') ?? 'q').toUpperCase();
    keyLabels.KeyR = (m.get('KeyR') ?? 'r').toUpperCase();
  }).catch(() => undefined);
}

/** Text glyph for `action` on `device`: Ⓐ Ⓧ Ⓨ RB, or "Clic gauche", "Clic droit", "Q", "R". */
export function glyph(action: Action, device: Device): string {
  if (device === 'gamepad') return PAD_GLYPH[action];
  const left = lang === 'fr' ? 'Clic gauche' : 'Left click';
  const right = lang === 'fr' ? 'Clic droit' : 'Right click';
  const esc = lang === 'fr' ? 'Échap' : 'Esc';
  switch (action) {
    case 'grab':
      return left;
    case 'tool':
      return right;
    case 'swap':
      return keyLabels.KeyQ;
    case 'tilt':
      return keyLabels.KeyR;
    case 'skip':
    case 'pause':
      return esc;
    case 'move':
      return 'WASD / ↑↓←→';
  }
}
