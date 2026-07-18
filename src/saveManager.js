const STORAGE_KEY = 'pixelKitchenSim.save';
const SAVE_SCHEMA_VERSION = 2;

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeId(prefix) {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultSave() {
    return {
        version: SAVE_SCHEMA_VERSION,
        player: {
            id: makeId('player'),
            token: makeId('token'),
            nickname: '',
            createdAt: new Date().toISOString()
        },
        levels: {},
        customLevels: [],
        settings: {
            language: 'en',
            showLabels: true,
            audioEnabled: true
        },
        gameCompleted: false
    };
}

export class SaveManager {
    constructor() {
        this.levelDatabase = [];
        this.data = this._load();
    }

    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return this._normalise(parsed);
        } catch (error) {
            console.warn('Could not read local save data. Starting with a new save.', error);
            return defaultSave();
        }
    }

    _normalise(raw) {
        const defaults = defaultSave();
        const data = {
            ...defaults,
            ...raw,
            player: { ...defaults.player, ...(raw?.player || {}) },
            levels: raw?.levels && typeof raw.levels === 'object' ? raw.levels : {},
            customLevels: Array.isArray(raw?.customLevels) ? raw.customLevels : [],
            settings: { ...defaults.settings, ...(raw?.settings || {}) }
        };

        if (!data.player.id) data.player.id = makeId('player');
        if (!data.player.token) data.player.token = makeId('token');
        if (typeof data.player.nickname !== 'string') data.player.nickname = '';
        data.version = SAVE_SCHEMA_VERSION;
        return data;
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (error) {
            console.error('Could not persist local save data.', error);
        }
    }

    setLevelDatabase(levelDatabase) {
        this.levelDatabase = Array.isArray(levelDatabase) ? levelDatabase : [];
        let migrated = false;

        this.levelDatabase.forEach((level, index) => {
            const stableKey = this.resolveLevelKey(level);
            const legacyProgress = this.data.levels[index];
            if (stableKey && legacyProgress && !this.data.levels[stableKey]) {
                this.data.levels[stableKey] = legacyProgress;
                delete this.data.levels[index];
                migrated = true;
            }
        });

        if (migrated) this._persist();
    }

    resolveLevelIndex(levelRef) {
        if (Number.isInteger(levelRef)) return levelRef;
        if (!levelRef || !this.levelDatabase.length) return -1;

        return this.levelDatabase.findIndex(level =>
            level === levelRef ||
            (levelRef.customId && level.customId === levelRef.customId) ||
            (!levelRef.customId && level.levelId === levelRef.levelId)
        );
    }

    resolveLevelKey(levelRef) {
        const level = Number.isInteger(levelRef) ? this.levelDatabase[levelRef] : levelRef;
        if (!level) return null;
        if (level.customId) return `custom:${level.customId}`;
        if (level.levelId !== undefined && level.levelId !== null) return `level:${level.levelId}`;
        return null;
    }

    getLevelProgress(levelRef) {
        const key = this.resolveLevelKey(levelRef);
        const progress = key ? this.data.levels[key] : null;
        return {
            completed: Boolean(progress?.completed),
            highScore: Number(progress?.highScore) || 0,
            stars: Math.max(0, Math.min(3, Number(progress?.stars) || 0)),
            lastPlayedAt: progress?.lastPlayedAt || null
        };
    }

    updateLevelCompletion(levelRef, score, stars) {
        const key = this.resolveLevelKey(levelRef);
        if (!key) return;

        const previous = this.getLevelProgress(levelRef);
        const safeScore = Math.max(0, Math.floor(Number(score) || 0));
        const safeStars = Math.max(0, Math.min(3, Math.floor(Number(stars) || 0)));
        this.data.levels[key] = {
            completed: true,
            highScore: Math.max(previous.highScore, safeScore),
            stars: Math.max(previous.stars, safeStars),
            lastPlayedAt: new Date().toISOString()
        };
        this._persist();
    }

    isLevelUnlocked(levelRef) {
        const index = this.resolveLevelIndex(levelRef);
        const level = Number.isInteger(levelRef) ? this.levelDatabase[levelRef] : levelRef;
        if (!level || index < 0) return false;
        if (level.customId) return true;
        if (index === 0) return true;

        for (let previousIndex = index - 1; previousIndex >= 0; previousIndex--) {
            const previous = this.levelDatabase[previousIndex];
            if (!previous?.customId) return this.getLevelProgress(previous).completed;
        }
        return true;
    }

    getSetting(name) {
        return this.data.settings[name];
    }

    saveSetting(name, value) {
        this.data.settings[name] = value;
        this._persist();
    }

    isGameCompleted() {
        return Boolean(this.data.gameCompleted);
    }

    setGameCompleted(completed) {
        this.data.gameCompleted = Boolean(completed);
        this._persist();
    }

    getPlayerProfile() {
        return clone(this.data.player);
    }

    getPlayerNickname() {
        return this.data.player.nickname || '';
    }

    setPlayerNickname(nickname) {
        const sanitized = String(nickname || '').replace(/\s+/g, ' ').trim().slice(0, 24);
        this.data.player.nickname = sanitized || 'Chef';
        this._persist();
        return this.data.player.nickname;
    }

    getCustomLevels() {
        return clone(this.data.customLevels);
    }

    getCustomLevel(customId) {
        return clone(this.data.customLevels.find(level => level.customId === customId) || null);
    }

    findCustomLevelBySource(sourceKey) {
        return clone(this.data.customLevels.find(level => level.origin?.sourceKey === sourceKey) || null);
    }

    saveCustomLevel(levelData, existingCustomId = null, origin = null) {
        const now = new Date().toISOString();
        const requestedId = existingCustomId || levelData?.customId;
        const existingIndex = this.data.customLevels.findIndex(level => level.customId === requestedId);
        const existing = existingIndex >= 0 ? this.data.customLevels[existingIndex] : null;
        const customId = existing?.customId || requestedId || makeId('level');
        const cleanLevel = clone(levelData || {});

        delete cleanLevel._levelIndex;
        delete cleanLevel.filename;
        delete cleanLevel.levelKey;

        const savedLevel = {
            ...cleanLevel,
            customId,
            source: 'local',
            levelId: cleanLevel.levelId ?? existing?.levelId ?? `custom-${customId.slice(-6)}`,
            name: String(cleanLevel.name || existing?.name || 'Untitled Kitchen').slice(0, 60),
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            origin: origin || existing?.origin || null
        };

        if (existingIndex >= 0) this.data.customLevels[existingIndex] = savedLevel;
        else this.data.customLevels.push(savedLevel);
        this._persist();
        return clone(savedLevel);
    }

    deleteCustomLevel(customId) {
        const index = this.data.customLevels.findIndex(level => level.customId === customId);
        if (index < 0) return false;
        this.data.customLevels.splice(index, 1);
        delete this.data.levels[`custom:${customId}`];
        this._persist();
        return true;
    }

    makePlayableLevelList(officialLevels) {
        const official = Array.isArray(officialLevels) ? officialLevels.map(clone) : [];
        return [...official, ...this.getCustomLevels()];
    }
}
