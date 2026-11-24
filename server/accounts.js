// Extended from Lab 5's file-backed registration and sign-in handlers.
// Node's built-in scrypt replaces argon2 to avoid a native build dependency.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const deriveKey = promisify(scrypt);

class Accounts {
    constructor(directory) {
        fs.mkdirSync(directory, { recursive: true });
        this.file = path.join(directory, 'users.json');
        if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, '{}\n');
        this.users = Object.assign(Object.create(null), JSON.parse(fs.readFileSync(this.file, 'utf8')));
    }

    save() {
        fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.users, null, 2) + '\n');
        fs.renameSync(this.file + '.tmp', this.file);
    }

    publicUser(username) {
        const user = this.users[username];
        return user ? { username, name: user.name } : null;
    }

    async register(body = {}) {
        const { password, confirmPassword } = body;
        const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!/^[a-z0-9_]{3,20}$/.test(username))
            throw new Error('Username must be 3–20 letters, numbers, or underscores.');
        if (!name || name.length > 20 || /[\x00-\x1f]/.test(name))
            throw new Error('Display name must contain 1–20 characters.');
        if (typeof password !== 'string' || password.length < 8 || password.length > 128)
            throw new Error('Password must contain 8–128 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (Object.hasOwn(this.users, username)) throw new Error('That username is already taken.');
        const salt = randomBytes(16).toString('hex');
        const hash = (await deriveKey(password, salt, 64)).toString('hex');
        // Recheck after asynchronous hashing, as in the completed Lab 5 solution.
        if (Object.hasOwn(this.users, username)) throw new Error('That username is already taken.');
        this.users[username] = {
            name, salt, hash,
            stats: { played: 0, wins: 0, draws: 0, delivered: 0, collected: 0, hits: 0 }
        };
        this.save();
        return this.publicUser(username);
    }

    async signin(body = {}) {
        const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
        const user = Object.hasOwn(this.users, username) ? this.users[username] : null;
        if (typeof body.password !== 'string' || body.password.length > 128 || !user)
            throw new Error('Incorrect username or password.');
        const candidate = await deriveKey(body.password, user.salt, 64);
        const expected = Buffer.from(user.hash, 'hex');
        if (expected.length !== candidate.length || !timingSafeEqual(expected, candidate))
            throw new Error('Incorrect username or password.');
        return this.publicUser(username);
    }

    record(result) {
        if (result.cheated || result.reason === 'cancelled') return;
        for (const player of result.players) {
            const user = this.users[player.username];
            if (!user) continue;
            const stats = user.stats;
            stats.played++;
            stats.wins += Number(result.winner === player.username);
            stats.draws += Number(result.winner === null);
            stats.delivered += player.delivered;
            stats.collected += player.collected;
            stats.hits += player.hits;
        }
        this.save();
    }

    leaderboard() {
        return Object.keys(this.users).filter(username => this.users[username].stats.played > 0)
            .map(username => ({ ...this.publicUser(username), ...this.users[username].stats }))
            .sort((a, b) => b.wins - a.wins || b.delivered - a.delivered || a.username.localeCompare(b.username))
            .map((user, index) => ({ rank: index + 1, ...user }));
    }
}

module.exports = { Accounts };
