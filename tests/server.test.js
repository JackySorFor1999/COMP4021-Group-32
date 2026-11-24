const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { createGameServer } = require('../game_server');
const { Accounts } = require('../server/accounts');

function event(socket, name, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timed out waiting for ${name}`)); }, timeout);
        function listener(value) { clearTimeout(timer); resolve(value); }
        socket.once(name, listener);
    });
}
function emit(socket, name, payload = {}) {
    return new Promise((resolve, reject) => socket.timeout(3000).emit(name, payload,
        (error, result) => error ? reject(error) : resolve(result)));
}

test('accounts validate input, hash passwords, persist rankings, and exclude practice matches', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'courier-accounts-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const accounts = new Accounts(directory);
    await assert.rejects(accounts.register({ username: 'x', name: 'Blue', password: '12345678', confirmPassword: '12345678' }));
    await assert.rejects(accounts.register({ username: 'blue', name: 'Blue', password: 'short', confirmPassword: 'short' }));
    await assert.rejects(accounts.register({ username: 'blue', name: 'Blue', password: '12345678', confirmPassword: 'different' }));
    for (const name of ['blue', 'coral', '__proto__']) await accounts.register({ username: name, name, password: 'delivery123', confirmPassword: 'delivery123' });
    assert.equal(Object.getPrototypeOf(accounts.users), null);
    await assert.rejects(accounts.register({ username: 'BLUE', name: 'Other', password: 'delivery123', confirmPassword: 'delivery123' }));
    await assert.rejects(accounts.signin({ username: 'blue', password: 'wrong' }));
    assert.equal((await accounts.signin({ username: 'BLUE', password: 'delivery123' })).username, 'blue');
    assert.ok(!fs.readFileSync(accounts.file, 'utf8').includes('delivery123'));
    const players = [{ username: 'blue', delivered: 12, collected: 15, hits: 2 }, { username: 'coral', delivered: 8, collected: 10, hits: 1 }];
    accounts.record({ winner: 'blue', players, reason: 'delivery', cheated: false });
    accounts.record({ winner: 'coral', players, reason: 'delivery', cheated: true });
    accounts.record({ winner: null, players, reason: 'cancelled', cheated: false });
    const restored = new Accounts(directory);
    assert.equal(restored.leaderboard()[0].username, 'blue');
    assert.equal(restored.leaderboard()[0].played, 1);
    assert.equal(restored.leaderboard()[0].wins, 1);
    assert.equal(restored.leaderboard()[1].delivered, 8);
});

test('HTTP sessions and WebSocket rooms work together across multiple simultaneous users', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'courier-server-'));
    const server = createGameServer({ dataDir: directory });
    const sockets = [];
    t.after(async () => { sockets.forEach(socket => socket.disconnect()); await server.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    await new Promise(resolve => server.httpServer.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.httpServer.address().port}`;
    async function post(route, body, cookie) {
        const response = await fetch(url + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
        return { response, body: await response.json() };
    }
    async function login(name) {
        const registered = await post('/register', { username: name, name, password: 'delivery123', confirmPassword: 'delivery123' });
        assert.equal(registered.response.status, 200);
        const result = await post('/signin', { username: name, password: 'delivery123' });
        return result.response.headers.get('set-cookie').split(';')[0];
    }
    function connection(cookie, autoConnect = false) {
        const socket = io(url, { transports: ['websocket'], extraHeaders: cookie ? { Cookie: cookie } : {}, autoConnect, reconnection: false, forceNew: true });
        sockets.push(socket); return socket;
    }

    await t.test('public files work; private data and anonymous sockets are protected', async () => {
        assert.equal((await fetch(url)).status, 200);
        assert.equal((await fetch(url + '/data/users.json')).status, 404);
        assert.equal((await fetch(url + '/validate')).status, 401);
        const anonymous = connection(); const failure = event(anonymous, 'connect_error'); anonymous.connect();
        assert.match((await failure).message, /sign in/i);
    });
    const cookies = await Promise.all(['blue', 'coral', 'third', 'fourth'].map(login));
    const clients = cookies.map(cookie => connection(cookie));
    await Promise.all(clients.map(async socket => { const connected = event(socket, 'connect'); socket.connect(); await connected; }));
    let code;
    await t.test('browser sessions validate and a second socket cannot occupy the same account', async () => {
        const validation = await fetch(url + '/validate', { headers: { Cookie: cookies[0] } });
        assert.equal((await validation.json()).user.username, 'blue');
        const duplicate = connection(cookies[0]); const failure = event(duplicate, 'connect_error'); duplicate.connect();
        assert.match((await failure).message, /another tab/i);
    });
    await t.test('pairing validates codes and limits each room to exactly two players', async () => {
        code = (await emit(clients[0], 'create_room')).code;
        assert.equal(code.length, 5);
        assert.ok((await emit(clients[1], 'join', { code: 'WRONG' })).error);
        assert.equal((await emit(clients[1], 'join', { code })).success, true);
        assert.ok((await emit(clients[2], 'join', { code })).error);
        assert.ok((await emit(clients[0], 'create_room')).error);
    });
    await t.test('both ready checks start the same match; another room is independent', async () => {
        await emit(clients[0], 'ready');
        assert.equal(server.rooms.get(code).status, 'waiting');
        const starts = clients.slice(0, 2).map(socket => event(socket, 'game_start'));
        await emit(clients[1], 'ready');
        const payloads = await Promise.all(starts);
        assert.equal(payloads[0].state.id, payloads[1].state.id);
        const secondCode = (await emit(clients[2], 'create_room')).code;
        await emit(clients[3], 'join', { code: secondCode });
        assert.equal(server.rooms.size, 2);
        assert.equal(server.rooms.get(secondCode).status, 'waiting');
    });
    await t.test('a disconnected courier can reconnect to the existing match', async () => {
        const id = server.rooms.get(code).game.id;
        clients[1].disconnect();
        const replacement = connection(cookies[1]);
        const restored = event(replacement, 'game_start'); replacement.connect();
        assert.equal((await restored).state.id, id);
        clients[1] = replacement;
    });
    await t.test('one match result is persisted once and both players can rematch', async () => {
        const room = server.rooms.get(code);
        room.game.players[0].score = 12; room.game.players[0].delivered = 12;
        const ended = clients.slice(0, 2).map(socket => event(socket, 'game_end'));
        room.game.finish('blue', 'delivery');
        const results = await Promise.all(ended);
        assert.equal(results[0].winner, 'blue'); assert.equal(results[1].winner, 'blue');
        assert.equal(server.accounts.leaderboard()[0].wins, 1);
        const before = room.game.id;
        await emit(clients[0], 'ready');
        const restarted = event(clients[0], 'game_start'); await emit(clients[1], 'ready');
        assert.notEqual((await restarted).state.id, before);
        assert.equal(room.game.players[0].cheat, false);
        assert.equal(room.game.players[0].score, 0);
        assert.equal(server.accounts.leaderboard()[0].wins, 1);
    });
    await t.test('leaving cancels the countdown and sign-out invalidates the HTTP session', async () => {
        const ended = event(clients[0], 'game_end');
        await emit(clients[1], 'leave'); assert.equal((await ended).reason, 'cancelled');
        assert.equal((await post('/signout', {}, cookies[1])).body.success, true);
        assert.equal((await fetch(url + '/validate', { headers: { Cookie: cookies[1] } })).status, 401);
    });
});
