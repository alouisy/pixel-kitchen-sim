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
        const limit = toSafeInt(url.searchParams.get('limit'), 1, 100) || 10;

        const isGlobal = scope === 'all' || scope === 'global:official' || scope === 'global:community';
        const isAllowed = isGlobal || await isAllowedLevelKey(scope);
        if (!isAllowed) return json(400, { error: 'Unknown leaderboard scope.' });

        try {
            if (isGlobal) {
                const showCommunity = scope === 'global:community';
                
                // Fetch leaderboard entries (we fetch a reasonable amount to support in-memory aggregation)
                const queryParams = new URLSearchParams({
                    select: 'player_token,nickname,level_key,score,stars,updated_at',
                    limit: '2000'
                });
                if (!showCommunity) {
                    queryParams.set('level_key', 'in.(level:1,level:2,level:3,level:4,level:5)');
                }
                
                const entries = await supabaseRequest(`leaderboard_entries?${queryParams}`);
                
                // If showing community levels, fetch currently active levels to filter out deleted level scores
                let activeCustomIds = null;
                if (showCommunity) {
                    try {
                        const customQuery = new URLSearchParams({
                            select: 'id',
                            limit: '2000'
                        });
                        const customLevels = await supabaseRequest(`custom_levels?${customQuery}`);
                        activeCustomIds = new Set((customLevels || []).map(c => String(c.id)));
                    } catch (err) {
                        console.error('Failed to fetch active custom levels for leaderboard filter:', err);
                    }
                }

                // Group entries by player_token to sum scores
                const players = {};
                for (const entry of entries) {
                    const token = entry.player_token;
                    if (!token) continue;

                    // Filter out custom levels that are no longer active
                    if (entry.level_key.startsWith('custom:')) {
                        const customId = entry.level_key.substring(7);
                        if (activeCustomIds && !activeCustomIds.has(customId)) {
                            continue;
                        }
                    }

                    if (!players[token]) {
                        players[token] = {
                            nickname: entry.nickname,
                            score: 0,
                            stars: 0,
                            updated_at: entry.updated_at,
                            scoresByLevel: {}
                        };
                    }

                    // Keep the latest nickname and update timestamp
                    if (new Date(entry.updated_at) > new Date(players[token].updated_at)) {
                        players[token].nickname = entry.nickname;
                        players[token].updated_at = entry.updated_at;
                    }

                    // Store unique scores per level (take best if duplicates exist)
                    const existingLvl = players[token].scoresByLevel[entry.level_key];
                    if (!existingLvl || entry.score > existingLvl.score || (entry.score === existingLvl.score && entry.stars > existingLvl.stars)) {
                        players[token].scoresByLevel[entry.level_key] = {
                            score: entry.score,
                            stars: entry.stars,
                            updated_at: entry.updated_at
                        };
                    }
                }

                // Calculate totals for each player
                const results = [];
                const officialKeys = ['level:1', 'level:2', 'level:3', 'level:4', 'level:5'];

                for (const token in players) {
                    const player = players[token];
                    let totalScore = 0;
                    let totalStars = 0;
                    let latestUpdated = new Date(0);
                    let hasPlayedAny = false;

                    for (const levelKey in player.scoresByLevel) {
                        const isOfficial = officialKeys.includes(levelKey);
                        const isCommunity = levelKey.startsWith('custom:');

                        if (isOfficial || (showCommunity && isCommunity)) {
                            const val = player.scoresByLevel[levelKey];
                            totalScore += val.score;
                            totalStars += val.stars;
                            const dt = new Date(val.updated_at);
                            if (dt > latestUpdated) latestUpdated = dt;
                            hasPlayedAny = true;
                        }
                    }

                    if (hasPlayedAny) {
                        results.push({
                            nickname: player.nickname,
                            score: totalScore,
                            stars: totalStars,
                            updated_at: latestUpdated.getTime() > 0 ? latestUpdated.toISOString() : player.updated_at
                        });
                    }
                }

                // Sort results by score desc, stars desc, updated_at asc
                results.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    if (b.stars !== a.stars) return b.stars - a.stars;
                    return new Date(a.updated_at) - new Date(b.updated_at);
                });

                return json(200, { entries: results.slice(0, limit) });
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
