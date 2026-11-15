import { GameTuningSchema, type GameTuning } from '../../schemas/tuning.js';
import game from './game.json';

/** Validated at module load. */
export const gameTuning: GameTuning = GameTuningSchema.parse(game);
