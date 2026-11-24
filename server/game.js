// Lab 3's update/draw, direction, speed-up, and bounding-box patterns,
// extended to a time-based simulation on the server shared by both browsers.
const crypto = require('node:crypto');

const RULES = Object.freeze({ duration: 180, target: 12, capacity: 3, speed: 215,
    dashCooldown: 3, dashDuration: 0.18, boostDuration: 5, countdown: 3 });
const MAP = Object.freeze({
    width: 1200, height: 720,
    desks: [{ x: 108, y: 360 }, { x: 1092, y: 360 }],
    obstacles: [
        { x: 286, y: 100, w: 190, h: 122, label: 'SCIENCE BLOCK', type: 'building' },
        { x: 724, y: 100, w: 190, h: 122, label: 'THE LIBRARY', type: 'building' },
        { x: 286, y: 500, w: 190, h: 118, label: 'GREENHOUSE', type: 'garden' },
        { x: 724, y: 500, w: 190, h: 118, label: 'CAMPUS CAFÉ', type: 'cafe' },
        { x: 560, y: 92, w: 80, h: 90, type: 'fountain' },
        { x: 560, y: 550, w: 80, h: 78, type: 'garden' }
    ],
    pickups: [
        { x: 420, y: 290 }, { x: 470, y: 350 }, { x: 450, y: 430 },
        { x: 580, y: 260 }, { x: 620, y: 460 }, { x: 730, y: 350 },
        { x: 780, y: 290 }, { x: 750, y: 430 }, { x: 555, y: 375 }, { x: 645, y: 375 }
    ],
    boosts: [{ x: 370, y: 465 }, { x: 830, y: 465 }]
});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function blocked(x, y, radius = 17) {
    if (x < 28 || x > MAP.width - 28 || y < 34 || y > MAP.height - 28) return true;
    return MAP.obstacles.some(o => {
        const dx = x - clamp(x, o.x, o.x + o.w);
        const dy = y - clamp(y, o.y, o.y + o.h);
        return dx * dx + dy * dy < radius * radius;
    });
}

class Game {
    constructor(members, now = Date.now()) {
        this.id = crypto.randomUUID();
        this.startsAt = now + RULES.countdown * 1000;
        this.endsAt = this.startsAt + RULES.duration * 1000;
        this.now = now;
        this.cheated = false;
        this.result = null;
        this.events = [];
        this.parcelId = 0;
        this.nextParcel = now;
        this.players = members.map((member, index) => ({
            username: member.username, name: member.name, team: index,
            x: index === 0 ? 180 : 1020, y: 360, facing: index === 0 ? 3 : 1,
            moving: false, carrying: 0, score: 0, collected: 0, delivered: 0,
            dropped: 0, hits: 0, collisions: 0, cheat: false,
            dashUntil: 0, dashReadyAt: 0, stunUntil: 0, immuneUntil: 0,
            boostUntil: 0, dashX: 0, dashY: 0, lastToggle: 0,
            input: { x: 0, y: 0, dash: false, at: now }
        }));
        this.parcels = MAP.pickups.map(p => this.parcel(p.x, p.y, now));
        this.boosts = MAP.boosts.map((p, i) => ({ id: i, ...p, readyAt: 0 }));
        this.robots = [
            { id: 0, x: 330, y: 270, axis: 'x', min: 330, max: 870, direction: 1, speed: 95 },
            { id: 1, x: 870, y: 450, axis: 'x', min: 330, max: 870, direction: -1, speed: 105 },
            { id: 2, x: 600, y: 240, axis: 'y', min: 240, max: 480, direction: 1, speed: 85 }
        ];
    }

    parcel(x, y, availableAt) {
        return { id: ++this.parcelId, x, y, availableAt };
    }

    event(type, player, extra = {}) {
        this.events.push({ type, username: player?.username, x: player?.x, y: player?.y, ...extra });
    }

    input(username, value, now = Date.now()) {
        const player = this.players.find(p => p.username === username);
        if (!player || this.result || !value || typeof value !== 'object') return;
        const axis = n => typeof n === 'number' && Number.isFinite(n) ? clamp(n, -1, 1) : 0;
        player.input = { x: axis(value.x), y: axis(value.y),
            dash: player.input.dash || value.dash === true, at: now };
    }

    toggleCheat(username, now = Date.now()) {
        const player = this.players.find(p => p.username === username);
        if (!player || this.result || now < this.startsAt || now - player.lastToggle < 250) return;
        player.lastToggle = now;
        player.cheat = !player.cheat;
        this.cheated ||= player.cheat;
        if (player.cheat) player.stunUntil = 0;
        this.event('cheat', player, { enabled: player.cheat });
    }

    drop(player, now) {
        if (!player.carrying) return;
        player.carrying--;
        player.dropped++;
        // A grace interval prevents a stunned player immediately collecting it again.
        const directions = [[0, 36], [36, 0], [0, -36], [-36, 0]];
        const offset = directions.find(([dx, dy]) => !blocked(player.x + dx, player.y + dy, 10)) || [0, 0];
        this.parcels.push(this.parcel(player.x + offset[0], player.y + offset[1], now + 550));
    }

    move(player, dx, dy) {
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
        for (let i = 0; i < steps; i++) {
            if (!blocked(player.x + dx / steps, player.y)) player.x += dx / steps;
            if (!blocked(player.x, player.y + dy / steps)) player.y += dy / steps;
        }
    }

    step(dt, now = Date.now()) {
        this.now = now;
        if (this.result || now < this.startsAt) return;
        if (now >= this.endsAt) {
            const [a, b] = this.players;
            this.finish(a.score === b.score ? null : a.score > b.score ? a.username : b.username, 'timeout', now);
            return;
        }
        dt = clamp(dt, 0, 0.1);
        for (const robot of this.robots) {
            robot[robot.axis] += robot.direction * robot.speed * dt;
            if (robot[robot.axis] >= robot.max || robot[robot.axis] <= robot.min) {
                robot[robot.axis] = clamp(robot[robot.axis], robot.min, robot.max);
                robot.direction *= -1;
            }
        }
        for (const player of this.players) {
            let { x: dx, y: dy } = player.input;
            if (now - player.input.at > 500) { dx = 0; dy = 0; player.input.dash = false; }
            const length = Math.hypot(dx, dy);
            if (length > 1) { dx /= length; dy /= length; }
            if (dx || dy) player.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 4 : 2);
            if (player.input.dash && now >= player.dashReadyAt && now >= player.stunUntil) {
                player.dashX = dx || dy ? dx : [0, -1, 0, 1, 0][player.facing];
                player.dashY = dx || dy ? dy : [0, 0, -1, 0, 1][player.facing];
                player.dashUntil = now + RULES.dashDuration * 1000;
                player.dashReadyAt = now + RULES.dashCooldown * 1000;
                this.event('dash', player);
            }
            player.input.dash = false;
            const dashing = now < player.dashUntil;
            const speed = RULES.speed * (player.cheat ? 1.65 : now < player.boostUntil ? 1.4 : 1);
            player.moving = (Boolean(dx || dy) || dashing) && now >= player.stunUntil;
            if (player.moving) this.move(player,
                (dashing ? player.dashX * 3.2 : dx) * speed * dt,
                (dashing ? player.dashY * 3.2 : dy) * speed * dt);

            for (const robot of this.robots) {
                if (distance(player, robot) < 34 && !player.cheat && now >= player.immuneUntil) {
                    player.stunUntil = now + 850;
                    player.immuneUntil = now + 2000;
                    player.dashUntil = 0;
                    player.collisions++;
                    this.drop(player, now);
                    this.event('collision', player);
                }
            }
            for (const boost of this.boosts) {
                if (now >= boost.readyAt && distance(player, boost) < 30) {
                    player.boostUntil = now + RULES.boostDuration * 1000;
                    boost.readyAt = now + 12000;
                    this.event('boost', player);
                }
            }
            if (now >= player.stunUntil) {
                for (let i = this.parcels.length - 1; i >= 0; i--) {
                    const parcel = this.parcels[i];
                    if (player.carrying < RULES.capacity && now >= parcel.availableAt && distance(player, parcel) < 30) {
                        player.carrying++;
                        player.collected++;
                        this.parcels.splice(i, 1);
                        this.event('pickup', player);
                    }
                }
            }
        }

        // A dash can hit once per immunity window. Both players are evaluated
        // against the same shared state, rather than trusting a browser's claim.
        for (const attacker of this.players) {
            const victim = this.players.find(p => p !== attacker);
            if (now < attacker.dashUntil && distance(attacker, victim) < 37 && now >= victim.immuneUntil && !victim.cheat) {
                victim.stunUntil = now + 450;
                victim.immuneUntil = now + 1500;
                attacker.hits++;
                this.drop(victim, now);
                this.event('hit', attacker, { victim: victim.username });
            }
        }

        // Finish only after evaluating both deposits: simultaneous winning
        // deliveries are a draw, not a win determined by array order.
        for (const player of this.players) {
            if (player.carrying && distance(player, MAP.desks[player.team]) < 58 && now >= player.stunUntil) {
                const count = player.carrying;
                player.delivered += count;
                player.score += count * (player.cheat ? RULES.target : 1);
                player.carrying = 0;
                this.event('delivery', player, { count });
            }
        }
        const winners = this.players.filter(p => p.score >= RULES.target);
        if (winners.length) this.finish(winners.length === 2 ? null : winners[0].username, 'delivery', now);

        if (now >= this.nextParcel && this.parcels.length < 10) {
            const free = MAP.pickups.filter(p => this.parcels.every(other => distance(p, other) > 25));
            if (free.length) {
                const point = free[Math.floor(Math.random() * free.length)];
                this.parcels.push(this.parcel(point.x, point.y, now));
            }
            this.nextParcel = now + 800;
        }
    }

    finish(winner, reason, now = Date.now()) {
        if (this.result) return this.result;
        this.result = {
            id: this.id, winner, reason, cheated: this.cheated,
            duration: Math.max(0, Math.round((now - this.startsAt) / 1000)),
            players: this.players.map(p => ({ username: p.username, name: p.name, team: p.team,
                score: p.score, collected: p.collected, delivered: p.delivered,
                dropped: p.dropped, hits: p.hits, collisions: p.collisions }))
        };
        return this.result;
    }

    snapshot(now = Date.now()) {
        return {
            id: this.id, now, startsAt: this.startsAt, endsAt: this.endsAt, cheated: this.cheated,
            players: this.players.map(({ input, lastToggle, dashX, dashY, ...player }) => player),
            parcels: this.parcels, robots: this.robots, boosts: this.boosts
        };
    }
}

module.exports = { Game, MAP, RULES, blocked };
