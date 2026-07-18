import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES } from '../src/gameData.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

async function readJson(relativePath) {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

function assert(condition, message) {
    if (!condition) errors.push(message);
}

const roadmap = await readJson('public/levels/game_roadmap.json');
assert(Array.isArray(roadmap), 'public/levels/game_roadmap.json must be an array.');
assert(roadmap.length >= 5, 'The first public release requires at least five official levels.');

for (const entry of roadmap.slice(0, 5)) {
    assert(Number.isInteger(entry.levelId), `Roadmap entry has an invalid levelId: ${JSON.stringify(entry)}.`);
    assert(typeof entry.filename === 'string' && entry.filename.endsWith('.json'), `Level ${entry.levelId} has no JSON filename.`);
    if (!entry.filename) continue;

    let level;
    try {
        level = await readJson(`public/levels/${entry.filename}`);
    } catch (error) {
        errors.push(`Could not read public/levels/${entry.filename}: ${error.message}`);
        continue;
    }

    assert(level.levelId === entry.levelId, `Roadmap level ${entry.levelId} does not match ${entry.filename}.`);
    assert(Array.isArray(level.layout) && level.layout.length > 0, `Level ${entry.levelId} has no layout.`);
    assert(Array.isArray(level.availableMeals) && level.availableMeals.length > 0, `Level ${entry.levelId} has no available meals.`);
    assert(Array.isArray(level.starThresholds) && level.starThresholds.length === 3, `Level ${entry.levelId} must define three star thresholds.`);

    const thresholds = level.starThresholds || [];
    assert(thresholds.every((value, index) => Number.isFinite(value) && (index === 0 || value >= thresholds[index - 1])), `Level ${entry.levelId} has unsorted or invalid star thresholds.`);

    for (const meal of level.availableMeals || []) {
        assert(Boolean(RECIPES[meal]), `Level ${entry.levelId} references unknown recipe "${meal}".`);
    }

    for (const item of level.layout || []) {
        assert(Number.isFinite(item?.position?.x) && Number.isFinite(item?.position?.z), `Level ${entry.levelId} has a layout item without an x/z position.`);
        assert(Math.abs(item?.position?.x ?? 0) <= 4.5 && Math.abs(item?.position?.z ?? 0) <= 4.5, `Level ${entry.levelId} has a layout item outside the playable 8x8 kitchen bounds.`);
    }
}

const level3 = await readJson('public/levels/level_3.json');
assert(level3.layout.some(item => item.name === 'Cheese Fridge'), 'Level 3 requires a Cheese Fridge for Cheese Omelette.');

const level5 = await readJson('public/levels/level_5.json');
for (const requiredObject of ['Bread Rack', 'Toaster', 'Bacon Pack']) {
    assert(level5.layout.some(item => item.name === requiredObject), `Level 5 is missing ${requiredObject}, required for BLT Sandwich.`);
}

if (errors.length) {
    console.error('Content validation failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exitCode = 1;
} else {
    console.log(`Content validation passed for ${roadmap.slice(0, 5).length} public levels.`);
}
