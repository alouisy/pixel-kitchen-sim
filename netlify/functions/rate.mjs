import { isValidPlayerToken, json, readJson, supabaseRequest } from './_supabase.mjs';

function isValidUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(request) {
    if (request.method !== 'POST') {
        return json(405, { error: 'Method not allowed.' });
    }

    const body = await readJson(request);
    const levelId = body?.levelId;
    const playerToken = body?.playerToken;
    const rating = parseInt(body?.rating, 10);

    if (!levelId || !isValidUuid(levelId)) {
        return json(400, { error: 'Invalid level ID.' });
    }
    if (!playerToken || !isValidPlayerToken(playerToken)) {
        return json(400, { error: 'Invalid player token.' });
    }
    if (isNaN(rating) || rating < 1 || rating > 5) {
        return json(400, { error: 'Rating must be an integer between 1 and 5.' });
    }

    try {
        // Upsert rating using PostgREST resolution header
        const payload = {
            level_id: levelId,
            player_token: playerToken,
            rating: rating,
            created_at: new Date().toISOString()
        };

        await supabaseRequest('level_ratings?on_conflict=level_id,player_token', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Prefer': 'resolution=merge-duplicates,return=representation'
            }
        });

        return json(200, { success: true, message: 'Rating submitted successfully.' });
    } catch (error) {
        console.error('Submit rating failed:', error);
        return json(503, { error: 'Rating service is unavailable.' });
    }
}
