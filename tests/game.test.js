const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game, MAP, RULES, blocked } = require('../server/game');
const members = [{ username: 'blue', name: 'Blue' }, { username: 'coral', name: 'Coral' }];
function game() { return new Game(members, 1000000); }
function active(g) { return g.startsAt + 100; }

test('matches have two players, four interactive entity types, and a 180-second limit', () => {
    const g = game();
    assert.equal(g.players.length, 2);
    assert.ok(g.parcels.length && g.robots.length && g.boosts.length);
    assert.equal(g.endsAt - g.startsAt, 180000);
    assert.equal(RULES.target, 12);
});

test('countdown prevents movement and diagonal input cannot exceed normal speed', () => {
    const g = game(), now = active(g), p = g.players[0];
    g.input('blue', { x: 1, y: 1 }, g.startsAt - 50);
    g.step(.1, g.startsAt - 10);
    assert.equal(p.x, 180);
    g.input('blue', { x: 1, y: 1 }, now);
    g.step(.1, now);
    assert.ok(Math.abs(Math.hypot(p.x - 180, p.y - 360) - RULES.speed * .1) < .001);
});

test('movement obeys walls and building collision, including a dash', () => {
    const g = game(), now = active(g), p = g.players[0];
    p.x = 264; p.y = 150;
    g.input('blue', { x: 1, y: 0, dash: true }, now);
    g.step(.1, now);
    assert.ok(p.x < 270);
    assert.ok(!blocked(p.x, p.y));
    p.x = 29; p.y = 350;
    g.input('blue', { x: -1, y: 0 }, now + 300);
    g.step(.1, now + 300);
    assert.ok(p.x >= 28);
});

test('stale and non-finite inputs stop movement; score and coordinates are never trusted', () => {
    const g = game(), now = active(g), p = g.players[0];
    g.input('blue', { x: Infinity, y: NaN, score: 999, carrying: 99 }, now);
    g.step(.1, now);
    assert.equal(p.x, 180); assert.equal(p.score, 0); assert.equal(p.carrying, 0);
    g.input('blue', { x: 1, y: 0 }, now);
    g.step(.1, now + 600);
    assert.equal(p.x, 180);
});

test('a contested parcel is awarded once, and bag capacity is enforced', () => {
    const g = game(), now = active(g);
    for (const p of g.players) { p.x = 400; p.y = 360; }
    g.parcels = [g.parcel(400, 360, 0)]; g.nextParcel = Infinity;
    g.step(.025, now);
    assert.equal(g.players.reduce((sum, p) => sum + p.collected, 0), 1);
    assert.equal(g.parcels.length, 0);
    g.players[0].carrying = RULES.capacity;
    g.players[1].x = 1000;
    g.parcels = [g.parcel(400, 360, 0)];
    g.step(.025, now + 25);
    assert.equal(g.players[0].carrying, RULES.capacity);
    assert.equal(g.parcels.length, 1);
});

test('only a player’s own desk deposits their bag and awards points', () => {
    const g = game(), now = active(g), p = g.players[0];
    p.x = MAP.desks[1].x; p.y = 360; p.carrying = 3;
    g.step(.025, now);
    assert.equal(p.carrying, 3); assert.equal(p.score, 0);
    p.x = MAP.desks[0].x;
    g.step(.025, now + 25);
    assert.equal(p.carrying, 0); assert.equal(p.score, 3); assert.equal(p.delivered, 3);
});

test('robot contact stuns, drops one parcel, and grants temporary immunity', () => {
    const g = game(), now = active(g), p = g.players[0];
    p.x = 400; p.y = 360; p.carrying = 2;
    g.parcels = []; g.nextParcel = Infinity;
    g.robots = [{ id: 0, x: 400, y: 360, axis: 'x', min: 300, max: 500, direction: 1, speed: 0 }];
    g.step(.025, now);
    assert.equal(p.carrying, 1); assert.equal(p.dropped, 1); assert.ok(p.stunUntil > now);
    g.step(.025, now + 25);
    assert.equal(p.dropped, 1); assert.equal(p.collisions, 1);
    assert.ok(g.parcels[0].availableAt > now);
});

test('dash hits affect the opponent once and the three-second cooldown is enforced', () => {
    const g = game(), now = active(g), [a, b] = g.players;
    a.x = 400; a.y = 360; b.x = 430; b.y = 360; b.carrying = 2;
    g.parcels = []; g.nextParcel = Infinity;
    g.input('blue', { x: 1, y: 0, dash: true }, now);
    g.step(.01, now);
    assert.equal(a.hits, 1); assert.equal(b.dropped, 1);
    const ready = a.dashReadyAt;
    g.input('blue', { x: 0, y: 0, dash: true }, now + 20);
    g.step(.01, now + 20);
    assert.equal(a.dashReadyAt, ready); assert.equal(a.hits, 1);
});

test('speed boosts are collected once and have a respawn timer', () => {
    const g = game(), now = active(g), p = g.players[0], boost = g.boosts[0];
    p.x = boost.x; p.y = boost.y;
    g.step(.025, now);
    assert.equal(p.boostUntil, now + 5000);
    assert.equal(boost.readyAt, now + 12000);
    g.step(.025, now + 25);
    assert.equal(p.boostUntil, now + 5000);
});

test('C toggles cheat benefits and disabling restores normal scoring', () => {
    const g = game(), now = active(g), p = g.players[0];
    g.toggleCheat('blue', now);
    assert.equal(p.cheat, true); assert.equal(g.cheated, true);
    g.toggleCheat('blue', now + 300);
    assert.equal(p.cheat, false); assert.equal(g.cheated, true);
    p.x = MAP.desks[0].x; p.y = 360; p.carrying = 1;
    g.step(.025, now + 325);
    assert.equal(p.score, 1); assert.equal(g.result, null);
});

test('cheat mode grants immunity and a one-parcel quick win; a rematch resets it', () => {
    const g = game(), now = active(g), p = g.players[0];
    g.toggleCheat('blue', now);
    p.x = 400; p.y = 360; p.carrying = 1;
    g.robots = [{ id: 0, x: 400, y: 360, axis: 'x', min: 300, max: 500, direction: 1, speed: 0 }];
    g.step(.025, now);
    assert.equal(p.collisions, 0);
    p.x = MAP.desks[0].x;
    g.step(.025, now + 25);
    assert.equal(g.result.winner, 'blue'); assert.equal(g.result.cheated, true);
    assert.equal(g.result.players[0].score, 12);
    assert.equal(game().players[0].cheat, false);
});

test('normal wins, simultaneous wins, timeout leads, and timeout draws terminate correctly', () => {
    const g = game(), now = active(g), p = g.players[0];
    p.score = 11; p.carrying = 1; p.x = 108; p.y = 360;
    g.step(.025, now); assert.equal(g.result.winner, 'blue');
    const simultaneous = game();
    for (const p of simultaneous.players) { p.score = 11; p.carrying = 1; p.x = MAP.desks[p.team].x; p.y = 360; }
    simultaneous.step(.025, active(simultaneous)); assert.equal(simultaneous.result.winner, null);
    const timeout = game(); timeout.players[1].score = 4;
    timeout.step(.025, timeout.endsAt); assert.equal(timeout.result.winner, 'coral');
    const draw = game(); draw.step(.025, draw.endsAt);
    assert.equal(draw.result.winner, null); assert.equal(draw.result.duration, 180);
});
