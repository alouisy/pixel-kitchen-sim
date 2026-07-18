const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
};

export function json(statusCode, body) {
    return new Response(JSON.stringify(body), { status: statusCode, headers: JSON_HEADERS });
}

export function sanitizeNickname(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

export function isValidPlayerToken(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_.-]{8,200}$/.test(value);
}

export function getAllowedLevelKeys() {
    const configured = process.env.ALLOWED_LEVEL_KEYS;
    return new Set((configured ? configured.split(',') : ['level:1', 'level:2', 'level:3', 'level:4', 'level:5'])
        .map(key => key.trim())
        .filter(Boolean));
}

export async function isAllowedLevelKey(levelKey) {
    const allowed = getAllowedLevelKeys();
    if (allowed.has(levelKey)) return true;

    if (typeof levelKey === 'string' && levelKey.startsWith('custom:')) {
        const id = levelKey.substring(7);
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            try {
                const query = new URLSearchParams({
                    select: 'id',
                    id: `eq.${id}`,
                    limit: '1'
                });
                const rows = await supabaseRequest(`custom_levels?${query}`);
                return rows && rows.length > 0;
            } catch (error) {
                console.error('Error verifying custom level key:', error);
                return false;
            }
        }
    }
    return false;
}


export async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

export async function supabaseRequest(path, options = {}) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase environment variables are not configured.');

    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Supabase request failed (${response.status}): ${message}`);
    }
    return response.status === 204 ? null : response.json();
}
