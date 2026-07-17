const FUNCTIONS_BASE_URL = '/.netlify/functions';

async function parseResponse(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
}

export class OnlineServices {
    constructor(baseUrl = FUNCTIONS_BASE_URL) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async fetchLeaderboard(scope = 'all', limit = 10) {
        const params = new URLSearchParams({ scope, limit: String(limit) });
        const response = await fetch(`${this.baseUrl}/leaderboard?${params}`);
        const body = await parseResponse(response);
        return Array.isArray(body.entries) ? body.entries : [];
    }

    async submitScore({ nickname, token, levelKey, score, stars }) {
        const response = await fetch(`${this.baseUrl}/leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, playerToken: token, levelKey, score, stars })
        });
        return parseResponse(response);
    }

    async publishCustomLevel({ token, nickname, name, data, id = null }) {
        const response = await fetch(`${this.baseUrl}/levels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerToken: token, nickname, name, data, id })
        });
        return parseResponse(response);
    }

    async fetchCustomLevel(id) {
        const response = await fetch(`${this.baseUrl}/levels?id=${encodeURIComponent(id)}`);
        return parseResponse(response);
    }

    async deleteCustomLevel(id, token) {
        const params = new URLSearchParams({ id, playerToken: token });
        const response = await fetch(`${this.baseUrl}/levels?${params}`, {
            method: 'DELETE'
        });
        return parseResponse(response);
    }

    async listCommunityLevels() {
        const response = await fetch(`${this.baseUrl}/levels`);
        const body = await parseResponse(response);
        return Array.isArray(body.levels) ? body.levels : [];
    }
}
