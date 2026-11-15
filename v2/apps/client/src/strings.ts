/** Tiny string tables. French for French browsers (or ?lang=fr), English otherwise (?lang=en). */
const params = new URLSearchParams(location.search);
export const LANG: 'fr' | 'en' = (params.get('lang') ?? navigator.language ?? 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
const pick = <T>(fr: T, en: T): T => (LANG === 'fr' ? fr : en);

/** Toy mode craving prompts (i18n keys from @ga/content cravings -> text). */
export const CRAVING_TEXT: Record<string, string> = pick(
  {
    'craving.seared_mushroom': 'Un champignon bien saisi, cuit à point.',
    'craving.crunchy_hot': 'Quelque chose de croustillant et brûlant.',
    'craving.tall_tower': 'Une grande tour de nourriture !',
  },
  {
    'craving.seared_mushroom': 'A seared, savory mushroom, cooked just right.',
    'craving.crunchy_hot': 'Something crunchy and piping hot.',
    'craving.tall_tower': 'A tall, savory tower of food!',
  },
);

export const HIGHLIGHT_TEXT: Record<string, string> = pick(
  {
    TOO_SMALL: 'Trop petit',
    PERFECT_SEAR: 'Saisie parfaite',
    RAW_CENTER: 'Cru au centre',
    MOSTLY_ASH: 'Surtout de la cendre',
    TALL_TOWER: 'Grande tour',
    TOO_SPICY: 'Trop épicé',
  },
  {
    TOO_SMALL: 'Too small',
    PERFECT_SEAR: 'Perfect sear',
    RAW_CENTER: 'Raw center',
    MOSTLY_ASH: 'Mostly ash',
    TALL_TOWER: 'Tall tower',
    TOO_SPICY: 'Too spicy',
  },
);

export const TIER_COLOR: Record<string, string> = { perfect: '#ffd23f', great: '#6fd36f', okay: '#f4a259', yuck: '#e4572e' };
export const TIER_TEXT: Record<string, string> = pick(
  { perfect: 'Parfait !', great: 'Très bon', okay: 'Bof', yuck: 'Beurk' },
  { perfect: 'Perfect!', great: 'Great', okay: 'Okay', yuck: 'Yuck' },
);

export const TILT_TEXT: readonly string[] = pick(['Vertical', '45°', 'À plat'], ['Vertical', '45°', 'Flat']);
export const TILT_ICON = ['│', '╱', '─'] as const;

export const TOOL_TEXT: Record<'cleaver' | 'torch', string> = pick(
  { cleaver: 'Couteau', torch: 'Chalumeau' },
  { cleaver: 'Cleaver', torch: 'Torch' },
);
export const TOOL_ICON: Record<'cleaver' | 'torch', string> = { cleaver: '🔪', torch: '🔥' };

export const EVENT_TEXT: Record<'TooHeavy' | 'SpawnRefused' | 'PlateEmpty' | 'CutTooSmall', string> = pick(
  {
    TooHeavy: 'Trop lourd !',
    SpawnRefused: 'La cuisine est pleine (40 aliments max).',
    PlateEmpty: "Pose d'abord de la nourriture sur l'assiette.",
    CutTooSmall: 'Trop petit pour être coupé.',
  },
  {
    TooHeavy: 'Too heavy to lift!',
    SpawnRefused: 'Kitchen is full (40 items max).',
    PlateEmpty: 'Put some food on the plate first.',
    CutTooSmall: 'Too small to cut.',
  },
);

export const ING: Record<string, { icon: string; name: string }> = pick(
  {
    mushroom: { icon: '🍄', name: 'champignon' },
    potato: { icon: '🥔', name: 'pomme de terre' },
    bread_rock: { icon: '🍞', name: 'pain' },
    cheese: { icon: '🧀', name: 'fromage' },
    pepper: { icon: '🌶️', name: 'poivron' },
    ash: { icon: '⚫', name: 'cendre' },
  },
  {
    mushroom: { icon: '🍄', name: 'mushroom' },
    potato: { icon: '🥔', name: 'potato' },
    bread_rock: { icon: '🍞', name: 'bread' },
    cheese: { icon: '🧀', name: 'cheese' },
    pepper: { icon: '🌶️', name: 'pepper' },
    ash: { icon: '⚫', name: 'ash' },
  },
);
export const ingName = (id: string): string => ING[id]?.name ?? id;
export const ingIcon = (id: string): string => ING[id]?.icon ?? '❓';

export const RECIPE_TEXT: Record<string, { icon: string; name: string }> = pick(
  {
    grilled_mushroom: { icon: '🍄', name: 'Champignon grillé' },
    fries: { icon: '🍟', name: 'Frites' },
    burger: { icon: '🍔', name: 'Burger' },
    cheeseburger: { icon: '🍔', name: 'Cheeseburger' },
    spicy_burger: { icon: '🍔', name: 'Burger piquant' },
  },
  {
    grilled_mushroom: { icon: '🍄', name: 'Grilled mushroom' },
    fries: { icon: '🍟', name: 'Fries' },
    burger: { icon: '🍔', name: 'Burger' },
    cheeseburger: { icon: '🍔', name: 'Cheeseburger' },
    spicy_burger: { icon: '🍔', name: 'Spicy burger' },
  },
);
export const recipeName = (id: string): string => RECIPE_TEXT[id]?.name ?? id;
export const recipeIcon = (id: string): string => RECIPE_TEXT[id]?.icon ?? '🍽️';

export interface Strings {
  title: string;
  subtitle: string;
  goal: string;
  steps: Array<[string, string]>;
  tip: string;
  start: string;
  best: string;
  over: string;
  newBest: string;
  served: string;
  missed: string;
  score: string;
  again: string;
  wait: string;
  cooked: string;
  cut: (n: number) => string;
  expired: (r: string, p: number) => string;
  servedToast: (r: string, pts: number, tip: number) => string;
  noOrder: string;
  problem: {
    missing: (i: string, r: string) => string;
    extra: (i: string, r: string) => string;
    raw: (i: string, r: string) => string;
    burnt: (i: string, r: string) => string;
    not_cut: (i: string, r: string, n: number, need: number) => string;
  };
  hint: {
    start: string;
    restart: string;
    spawn: (i: string) => string;
    grab: (i: string, n: number) => string;
    too_heavy: string;
    place: Record<'rock' | 'plate' | 'table' | 'floor', string>;
    serve: string;
    taste: string;
    cut: string;
    heat: string;
  };
  labels: { rock: string; plate: string };
  gauge: { raw: string; ok: string; burnt: string };
  help: string;
  helpLines: Array<[string, string]>;
}

export const T: Strings = pick<Strings>(
  {
    title: 'Coup de feu !',
    subtitle: 'Mini-démo V2 · mode Rush',
    goal: 'Sers un maximum de commandes avant la fin du chrono (3 min).',
    steps: [
      ['🧺', "Prends l'ingrédient demandé sur un tapis coloré"],
      ['🔪', 'Coupe-le si le ticket le demande (clic)'],
      ['🔥', 'Cuis-le sur la pierre chaude, retire-le quand la jauge est verte'],
      ['🍽️', "Pose tout sur l'assiette, puis sers"],
    ],
    tip: 'Plus tu sers vite, plus le pourboire est gros. Une commande ratée coûte 10 points.',
    start: 'pour commencer',
    best: 'Record',
    over: 'Service terminé !',
    newBest: 'Nouveau record !',
    served: 'Servies',
    missed: 'Ratées',
    score: 'Score',
    again: 'pour rejouer',
    wait: 'Un instant…',
    cooked: 'cuit',
    cut: (n) => `coupé ×${n}`,
    expired: (r, p) => `Commande ratée : ${r} (−${p})`,
    servedToast: (r, pts, tip) => `${r} servi ! +${pts}${tip > 0 ? ` (dont ${tip} de pourboire)` : ''}`,
    noOrder: 'Aucune commande en cours.',
    problem: {
      missing: (i, r) => `${r} : il manque ${i}.`,
      extra: (i, r) => `${r} : pas de ${i} dans cette recette. Plat jeté !`,
      raw: (i, r) => `${r} : ${i} pas assez cuit. Plat jeté !`,
      burnt: (i, r) => `${r} : ${i} brûlé ! Plat jeté.`,
      not_cut: (i, r, n, need) => `${r} : coupe ${i} en ${need} morceaux (là : ${n}). Plat jeté !`,
    },
    hint: {
      start: 'Commencer le service',
      restart: 'Rejouer',
      spawn: (i) => `Sortir : ${i}`,
      grab: (i, n) => (n > 1 ? `Ramasser ${i} (${n} morceaux)` : `Ramasser ${i}`),
      too_heavy: 'Trop lourd',
      place: { rock: 'Poser sur la pierre chaude', plate: "Poser sur l'assiette", table: 'Poser sur la table', floor: 'Poser par terre' },
      serve: 'Servir le plat',
      taste: 'Goûter',
      cut: 'couper',
      heat: 'chauffer',
    },
    labels: { rock: '🔥 Pierre chaude', plate: '🍽️ Assiette' },
    gauge: { raw: 'cru', ok: 'prêt !', burnt: 'brûlé' },
    help: 'Commandes',
    helpLines: [
      ['ZQSD / flèches', 'se déplacer'],
      ['E / Espace', 'prendre · poser · servir'],
      ['Clic gauche', 'couper / chauffer'],
      ['Souris', 'viser'],
      ['Tab', 'couteau ↔ chalumeau'],
      ['R', 'angle de coupe'],
      ['H', 'afficher / cacher cette aide'],
      ['Manette', 'stick · A prendre · RT outil · Y changer · X angle'],
    ],
  },
  {
    title: 'Dinner Rush!',
    subtitle: 'V2 mini-demo · Rush mode',
    goal: 'Serve as many orders as you can before the clock runs out (3 min).',
    steps: [
      ['🧺', 'Grab the ingredient the ticket asks for from a coloured mat'],
      ['🔪', 'Cut it if the ticket says so (click)'],
      ['🔥', 'Cook it on the hot stone, take it off when the gauge is green'],
      ['🍽️', 'Put everything on the plate, then serve'],
    ],
    tip: 'The faster you serve, the bigger the tip. A missed order costs 10 points.',
    start: 'to start',
    best: 'Best',
    over: 'Service over!',
    newBest: 'New record!',
    served: 'Served',
    missed: 'Missed',
    score: 'Score',
    again: 'to play again',
    wait: 'One moment…',
    cooked: 'cooked',
    cut: (n) => `cut ×${n}`,
    expired: (r, p) => `Missed order: ${r} (−${p})`,
    servedToast: (r, pts, tip) => `${r} served! +${pts}${tip > 0 ? ` (${tip} tip)` : ''}`,
    noOrder: 'No open order.',
    problem: {
      missing: (i, r) => `${r}: ${i} is missing.`,
      extra: (i, r) => `${r}: no ${i} in this recipe. Dish binned!`,
      raw: (i, r) => `${r}: the ${i} is undercooked. Dish binned!`,
      burnt: (i, r) => `${r}: the ${i} is burnt! Dish binned.`,
      not_cut: (i, r, n, need) => `${r}: cut the ${i} into ${need} pieces (now ${n}). Dish binned!`,
    },
    hint: {
      start: 'Start the service',
      restart: 'Play again',
      spawn: (i) => `Take out: ${i}`,
      grab: (i, n) => (n > 1 ? `Pick up ${i} (${n} pieces)` : `Pick up ${i}`),
      too_heavy: 'Too heavy',
      place: { rock: 'Put on the hot stone', plate: 'Put on the plate', table: 'Put on the table', floor: 'Drop on the floor' },
      serve: 'Serve the dish',
      taste: 'Taste',
      cut: 'cut',
      heat: 'heat',
    },
    labels: { rock: '🔥 Hot stone', plate: '🍽️ Plate' },
    gauge: { raw: 'raw', ok: 'ready!', burnt: 'burnt' },
    help: 'Controls',
    helpLines: [
      ['WASD / arrows', 'move'],
      ['E / Space', 'grab · place · serve'],
      ['Left click', 'cut / heat'],
      ['Mouse', 'aim'],
      ['Tab', 'cleaver ↔ torch'],
      ['R', 'cut angle'],
      ['H', 'show / hide this help'],
      ['Gamepad', 'stick · A grab · RT tool · Y swap · X angle'],
    ],
  },
);

/** Toy-mode help (kept for ?mode=toy). */
export const HELP_LINES: ReadonlyArray<readonly [string, string]> = T.helpLines;
