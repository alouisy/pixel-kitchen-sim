import { isValidPlayerToken, json, readJson, sanitizeNickname, supabaseRequest } from './_supabase.mjs';

function sanitizeLevelName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export default async function handler(request) {
    const url = new URL(request.url);

    if (request.method === 'GET') {
        const id = url.searchParams.get('id');
        if (!id) {
            // Get paginated community levels with ratings
            try {
                const limitVal = parseInt(url.searchParams.get('limit') || '10', 10);
                const pageVal = parseInt(url.searchParams.get('page') || '1', 10);
                const sortBy = url.searchParams.get('sortBy') || 'newest';
                const offset = (pageVal - 1) * limitVal;

                let order = 'created_at.desc';
                if (sortBy === 'highest_rated') {
                    order = 'average_rating.desc,rating_count.desc';
                } else if (sortBy === 'most_popular') {
                    order = 'rating_count.desc,average_rating.desc';
                }

                const query = new URLSearchParams({
                    select: 'id,nickname,name,description,difficulty,average_rating,rating_count,created_at,updated_at',
                    order: order,
                    limit: String(limitVal + 1), // fetch 1 extra to determine hasMore
                    offset: String(offset)
                });
                
                const levels = await supabaseRequest(`community_levels_with_ratings?${query}`);
                const hasMore = levels.length > limitVal;
                if (hasMore) {
                    levels.pop();
                }

                return json(200, { levels, hasMore });
            } catch (error) {
                console.error('Fetch custom levels failed:', error);
                return json(503, { error: 'Levels service is unavailable.' });
            }
        }

        // Fetch single level by ID (include rating info)
        try {
            const filter = new URLSearchParams({
                select: 'id,nickname,name,description,difficulty,data,created_at,updated_at,average_rating,rating_count',
                id: `eq.${id}`,
                limit: '1'
            });
            const rows = await supabaseRequest(`community_levels_with_ratings?${filter}`);
            if (!rows || rows.length === 0) {
                return json(404, { error: 'Level not found.' });
            }
            return json(200, rows[0]);
        } catch (error) {
            console.error('Fetch level failed:', error);
            return json(503, { error: 'Levels service is unavailable.' });
        }
    }

    if (request.method === 'POST') {
        const body = await readJson(request);
        const playerToken = body?.playerToken;
        const nickname = sanitizeNickname(body?.nickname);
        const name = sanitizeLevelName(body?.name);
        const description = String(body?.description || '').trim().slice(0, 300);
        const difficulty = parseInt(body?.difficulty, 10) || 3;
        const data = body?.data;
        const existingId = body?.id;

        const clampedDifficulty = Math.max(1, Math.min(5, difficulty));

        if (!playerToken || !isValidPlayerToken(playerToken) || !nickname || !name || !data) {
            return json(400, { error: 'Invalid level payload.' });
        }

        try {
            if (existingId) {
                // Update existing level
                const filter = new URLSearchParams({
                    select: 'id,player_token',
                    id: `eq.${existingId}`,
                    limit: '1'
                });
                const existingRows = await supabaseRequest(`custom_levels?${filter}`);
                if (!existingRows || existingRows.length === 0) {
                    return json(404, { error: 'Level not found to update.' });
                }
                const existing = existingRows[0];
                if (existing.player_token !== playerToken) {
                    return json(403, { error: 'You are not the creator of this level.' });
                }

                const payload = {
                    nickname,
                    name,
                    description,
                    difficulty: clampedDifficulty,
                    data,
                    updated_at: new Date().toISOString()
                };
                await supabaseRequest(`custom_levels?id=eq.${existingId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });
                return json(200, { id: existingId, name, nickname, description, difficulty: clampedDifficulty, data });
            } else {
                // Insert new level
                const payload = {
                    player_token: playerToken,
                    nickname,
                    name,
                    description,
                    difficulty: clampedDifficulty,
                    data,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                const rows = await supabaseRequest('custom_levels', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const inserted = rows?.[0] || payload;
                return json(200, { id: inserted.id, name, nickname, description, difficulty: clampedDifficulty, data });
            }
        } catch (error) {
            console.error('Save level failed:', error);
            return json(503, { error: 'Levels service is unavailable.' });
        }
    }

    if (request.method === 'DELETE') {
        const id = url.searchParams.get('id');
        const playerToken = url.searchParams.get('playerToken');

        if (!id || !playerToken || !isValidPlayerToken(playerToken)) {
            return json(400, { error: 'Invalid delete request parameters.' });
        }

        try {
            const filter = new URLSearchParams({
                select: 'id,player_token',
                id: `eq.${id}`,
                limit: '1'
            });
            const existingRows = await supabaseRequest(`custom_levels?${filter}`);
            if (!existingRows || existingRows.length === 0) {
                return json(404, { error: 'Level not found.' });
            }
            if (existingRows[0].player_token !== playerToken) {
                return json(403, { error: 'You are not the creator of this level.' });
            }

            await supabaseRequest(`custom_levels?id=eq.${id}`, { method: 'DELETE' });
            return json(200, { success: true });
        } catch (error) {
            console.error('Delete level failed:', error);
            return json(503, { error: 'Levels service is unavailable.' });
        }
    }

    return json(405, { error: 'Method not allowed.' });
}
