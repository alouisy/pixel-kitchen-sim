import { isAllowedLevelKey, isValidPlayerToken, json, readJson, sanitizeNickname, supabaseRequest } from './_supabase.mjs';

const MAX_SCORE = 50000;

function toSafeInt(value, minimum, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.max(minimum, Math.min(maximum, Math.floor(number)));
}

export default async function handler(request) {
    if (request.method === 'GET') {
        const url = new URL(request.url);
        const scope = url.searchParams.get('scope') || 'all';
        const limit = toSafeInt(url.searchParams.get('limit'), 1, 25) || 10;
        const isAllowed = await isAllowedLevelKey(scope);
        if (scope !== 'all' && !isAllowed) return json(400, { error: 'Unknown leaderboard scope.' });

        const query = new URLSearchParams({
            select: 'nickname,score,stars,updated_at',
            order: 'score.desc,stars.desc,updated_at.asc',
            limit: String(limit)
        });
        if (scope !== 'all') query.set('level_key', `eq.${scope}`);

        try {
            const entries = await supabaseRequest(`leaderboard_entries?${query}`);
            return json(200, { entries });
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
        const filter = new URLSearchParams({
            select: 'id,score,stars',
            level_key: `eq.${levelKey}`,
            player_token: `eq.${playerToken}`,
            limit: '1'
        });
        const existingRows = await supabaseRequest(`leaderboard_entries?${filter}`);
        const existing = existingRows[0];
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
