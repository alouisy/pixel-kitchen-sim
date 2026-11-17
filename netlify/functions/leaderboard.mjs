import { OFFICIAL_LEVEL_FILES, isAllowedLevelKey, isValidPlayerToken, json, readJson, sanitizeNickname, supabaseRequest } from './_supabase.mjs';

const MAX_SCORE = 50000;
const levelRulesCache = new Map();

function toSafeInt(value, minimum, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

// Loads duration and star thresholds for an official level (level:N) from its level file.
// Returns null when the key has no level file in the roadmap.
async function loadOfficialLevelRules(levelKey) {
    if (levelRulesCache.has(levelKey)) return levelRulesCache.get(levelKey);
    const filename = Object.hasOwn(OFFICIAL_LEVEL_FILES, levelKey) ? OFFICIAL_LEVEL_FILES[levelKey] : null;
    if (!filename) return null;

    const { default: level } = await import(`../../public/levels/${filename}`, { with: { type: 'json' } });
    if (!Array.isArray(level.starThresholds) || level.starThresholds.length !== 3) {
        throw new Error(`Level file ${filename} has invalid starThresholds.`);
    }
    const rules = {
        duration: Number(level.duration) || 0,
        starThresholds: level.starThresholds,
        maxPlausible: Math.ceil(level.starThresholds[2] * 2.5)
    };
    levelRulesCache.set(levelKey, rules);
    return rules;
}

export default async function handler(request) {
    if (request.method === 'GET') {
        const url = new URL(request.url);
        const scope = url.searchParams.get('scope') || 'all';
        const limit = toSafeInt(url.searchParams.get('limit'), 1, 100) || 10;

        const isGlobal = scope === 'all' || scope === 'global:official' || scope === 'global:community';
        const isAllowed = isGlobal || await isAllowedLevelKey(scope);
        if (!isAllowed) return json(400, { error: 'Unknown leaderboard scope.' });

        try {
            if (isGlobal) {
                // Totals are aggregated in SQL (see leaderboard_totals_* views in schema.sql).
                const showCommunity = scope === 'global:community';
                const view = showCommunity ? 'leaderboard_totals_community' : 'leaderboard_totals_official';

                const query = new URLSearchParams({
                    select: 'nickname,score,stars,updated_at',
                    order: 'score.desc,stars.desc,updated_at.asc',
                    limit: String(limit)
                });
                const entries = await supabaseRequest(`${view}?${query}`);
                return json(200, { entries: entries || [] });
            } else {
                // Return single level leaderboard
                const query = new URLSearchParams({
                    select: 'nickname,score,stars,updated_at',
                    level_key: `eq.${scope}`,
                    order: 'score.desc,stars.desc,updated_at.asc',
                    limit: String(limit)
                });
                const entries = await supabaseRequest(`leaderboard_entries?${query}`);
                return json(200, { entries });
            }
        } catch (error) {
            console.error('Leaderboard read failed:', error);
            return json(503, { error: 'Leaderboard service is unavailable.' });
        }
    }

    if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
    const body = await readJson(request);
    const nickname = sanitizeNickname(body?.nickname);
    const playerToken = body?.playerToken;
    const levelKey = body?.levelKey;
    const score = toSafeInt(body?.score, 0, MAX_SCORE);
    const stars = toSafeInt(body?.stars, 0, 3);

    const isAllowed = await isAllowedLevelKey(levelKey);
    if (!nickname || !isValidPlayerToken(playerToken) || !isAllowed || score === null || stars === null) {
        return json(400, { error: 'Invalid score submission.' });
    }

    try {
        // Plausibility checks apply to official levels only; custom levels keep the global MAX_SCORE cap.
        const isOfficialKey = levelKey.startsWith('level:');
        const rules = isOfficialKey ? await loadOfficialLevelRules(levelKey) : null;
        if (isOfficialKey && !rules) return json(400, { error: 'Invalid score submission.' });

        if (rules) {
            if (score > rules.maxPlausible) return json(400, { error: 'Implausible score.' });
            const expectedStars = rules.starThresholds.filter(threshold => score >= threshold).length;
            if (stars > expectedStars) return json(400, { error: 'Implausible score.' });
        }

        const filter = new URLSearchParams({
            select: 'id,score,stars,updated_at',
            level_key: `eq.${levelKey}`,
            player_token: `eq.${playerToken}`,
            limit: '1'
        });
        const existingRows = await supabaseRequest(`leaderboard_entries?${filter}`);
        const existing = existingRows[0];

        // Rate limit: one submission per level duration, measured from the last accepted update.
        if (existing && rules && rules.duration > 0) {
            const secondsSinceUpdate = (Date.now() - Date.parse(existing.updated_at)) / 1000;
            if (secondsSinceUpdate < rules.duration) return json(429, { error: 'Too many submissions.' });
        }

        const isBetter = !existing || score > existing.score || (score === existing.score && stars > existing.stars);

        if (!isBetter) return json(200, { accepted: false, entry: existing });

        const payload = { nickname, player_token: playerToken, level_key: levelKey, score, stars, updated_at: new Date().toISOString() };
        const rows = existing
            ? await supabaseRequest(`leaderboard_entries?id=eq.${existing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
            : await supabaseRequest('leaderboard_entries', { method: 'POST', body: JSON.stringify(payload) });

        return json(200, { accepted: true, entry: rows?.[0] || payload });
    } catch (error) {
        console.error('Leaderboard write failed:', error);
        return json(503, { error: 'Leaderboard service is unavailable.' });
    }
}
