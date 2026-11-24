// Extended from Lab 5 (Express, JSON endpoints, file-backed accounts and
// express-session) and Lab 6 (HTTP + Socket.IO, join/ready/start/end lifecycle).
const express = require('express');
const path = require('node:path');
const session = require('express-session');
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const { Server } = require('socket.io');
const { Accounts } = require('./server/accounts');
const { Game, MAP, RULES } = require('./server/game');

function createGameServer(options = {}) {
    const accounts = new Accounts(options.dataDir || path.join(__dirname, 'data'));
    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer, { maxHttpBufferSize: 8192, transports: ['websocket'] });
    const rooms = new Map();
    const membership = new Map();
    const connections = new Map();
    const disconnectTimers = new Map();
    const attempts = new Map();
    let closing = false;

    app.disable('x-powered-by');
    app.use(express.json({ limit: '8kb' }));
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.path.startsWith('/api') || ['/validate', '/signin', '/register'].includes(req.path))
            res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'POST' && req.headers.origin && req.headers.origin !== `${req.protocol}://${req.get('host')}`)
            return res.status(403).json({ error: 'Please use the game page to make this request.' });
        next();
    });

    // Same session middleware is shared by Express and Socket.IO, as in the labs.
    const gameSession = session({
        name: 'courier.sid', secret: randomBytes(32).toString('hex'),
        resave: false, saveUninitialized: false, rolling: true,
        cookie: { maxAge: 86400000, httpOnly: true, sameSite: 'lax' }
    });
    app.use(gameSession);
    io.engine.use(gameSession);

    const authenticationLimit = (req, res, next) => {
        const now = Date.now();
        const recent = (attempts.get(req.ip) || []).filter(time => now - time < 60000);
        if (recent.length >= 30) return res.status(429).json({ error: 'Too many attempts. Please try again in a minute.' });
        recent.push(now);
        attempts.set(req.ip, recent);
        next();
    };

    app.post('/register', authenticationLimit, async (req, res, next) => {
        try {
            await accounts.register(req.body);
            res.json({ success: true });
        } catch (error) {
            if (error.code) return next(error);
            res.status(400).json({ error: error.message });
        }
    });
    app.post('/signin', authenticationLimit, async (req, res, next) => {
        let user;
        try { user = await accounts.signin(req.body); }
        catch (error) {
            if (error.code) return next(error);
            return res.status(401).json({ error: error.message });
        }
        // Regenerate on login rather than carrying a previous session forward.
        req.session.regenerate(error => {
            if (error) return next(error);
            req.session.user = user;
            req.session.save(error => {
                if (error) return next(error);
                res.json({ user });
            });
        });
    });
    app.get('/validate', (req, res) => {
        if (!req.session.user) return res.status(401).json({ error: 'Please sign in to join a shift.' });
        res.json({ user: req.session.user });
    });
    app.post('/signout', (req, res, next) => {
        const username = req.session.user?.username;
        if (username) {
            leaveRoom(username);
            connections.get(username)?.disconnect(true);
        }
        req.session.destroy(error => {
            if (error) return next(error);
            res.clearCookie('courier.sid');
            res.json({ success: true });
        });
    });
    app.get('/api/config', (req, res) => res.json({ map: MAP, rules: RULES }));
    app.get('/api/leaderboard', (req, res) => res.json({ players: accounts.leaderboard() }));
    app.get('/README.html', (req, res) => res.sendFile(path.join(__dirname, 'README.html')));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use((error, req, res, next) => {
        if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON request.' });
        if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
        console.error('Request failed:', error.message);
        res.status(500).json({ error: 'The server could not save your request. Please try again.' });
    });

    const roomData = room => ({ code: room.code, status: room.status,
        members: room.members.map(member => ({ ...member })),
        disconnectedGrace: 15 });
    const availableRooms = () => [...rooms.values()]
        .filter(room => room.status === 'waiting' && room.members.length === 1 && room.members[0].connected)
        .map(room => ({ code: room.code, host: room.members[0].name }));
    function updatePlayers(room) { io.to(room.code).emit('update_players', roomData(room)); }
    function updateRooms() { io.emit('rooms', availableRooms()); }

    function finalize(room) {
        if (!room.game?.result || room.recorded) return;
        room.recorded = true;
        room.status = 'finished';
        room.members.forEach(member => { member.ready = false; });
        accounts.record(room.game.result);
        room.result = { ...room.game.result, leaderboard: accounts.leaderboard() };
        io.to(room.code).emit('game_end', room.result);
        updatePlayers(room);
        io.emit('leaderboard', accounts.leaderboard());
        updateRooms();
    }

    function startGame(room) {
        room.game = new Game(room.members);
        room.result = null;
        room.recorded = false;
        room.status = 'playing';
        io.to(room.code).emit('game_start', { map: MAP, rules: RULES, state: room.game.snapshot() });
        updatePlayers(room);
        updateRooms();
    }

    function leaveRoom(username) {
        clearTimeout(disconnectTimers.get(username));
        disconnectTimers.delete(username);
        const room = rooms.get(membership.get(username));
        if (!room) return;
        if (room.status === 'playing') {
            const opponent = room.members.find(member => member.username !== username && member.connected);
            const cancelled = Date.now() < room.game.startsAt || !opponent;
            room.game.finish(cancelled ? null : opponent.username, cancelled ? 'cancelled' : 'disconnect');
            finalize(room);
        }
        connections.get(username)?.leave(room.code);
        membership.delete(username);
        room.members = room.members.filter(member => member.username !== username);
        room.members.forEach(member => { member.ready = false; });
        if (!room.members.length) rooms.delete(room.code);
        else updatePlayers(room);
        updateRooms();
    }

    io.use((socket, next) => {
        const origin = socket.handshake.headers.origin;
        if (origin) {
            try {
                if (new URL(origin).host !== socket.handshake.headers.host) return next(new Error('Invalid game origin.'));
            } catch { return next(new Error('Invalid game origin.')); }
        }
        const user = socket.request.session?.user;
        if (!user || !accounts.publicUser(user.username)) return next(new Error('Please sign in first.'));
        if (connections.get(user.username)?.connected) return next(new Error('This account is already open in another tab. Use a different account for player two.'));
        socket.user = user;
        next();
    });

    // Lab 6's event-driven join -> ready -> game_start -> game_end flow,
    // expanded from one global game into independent rooms of two players.
    io.on('connection', socket => {
        const user = socket.user;
        connections.set(user.username, socket);
        clearTimeout(disconnectTimers.get(user.username));
        disconnectTimers.delete(user.username);
        socket.emit('rooms', availableRooms());
        const oldRoom = rooms.get(membership.get(user.username));
        if (oldRoom) {
            socket.join(oldRoom.code);
            oldRoom.members.find(member => member.username === user.username).connected = true;
            updatePlayers(oldRoom);
            if (oldRoom.status === 'playing') socket.emit('game_start', { map: MAP, rules: RULES, state: oldRoom.game.snapshot() });
            if (oldRoom.result) socket.emit('game_end', oldRoom.result);
        }

        const handle = callback => (payload, acknowledgement) => {
            const reply = typeof acknowledgement === 'function' ? acknowledgement : () => {};
            try {
                if (!socket.request.session?.user) throw new Error('Please sign in again.');
                reply({ success: true, ...callback(payload) });
            } catch (error) { reply({ error: error.message }); }
        };
        function joinRoom(room) {
            if (membership.has(user.username)) throw new Error('Leave your current room before joining another.');
            if (!room || room.status !== 'waiting') throw new Error('Room not found or the match has already started.');
            if (room.members.length >= 2) throw new Error('This room already has two couriers.');
            room.members.push({ ...user, ready: false, connected: true });
            membership.set(user.username, room.code);
            socket.join(room.code);
            updatePlayers(room);
            updateRooms();
            return { code: room.code };
        }
        socket.on('create_room', handle(() => {
            if (membership.has(user.username)) throw new Error('You are already in a room.');
            let code;
            do { code = randomBytes(3).toString('hex').slice(0, 5).toUpperCase(); } while (rooms.has(code));
            const room = { code, members: [], status: 'waiting', game: null, result: null, recorded: false };
            rooms.set(code, room);
            return joinRoom(room);
        }));
        socket.on('join', handle(payload => {
            const code = typeof payload?.code === 'string' ? payload.code.trim().toUpperCase() : '';
            return joinRoom(rooms.get(code));
        }));
        socket.on('ready', handle(() => {
            const room = rooms.get(membership.get(user.username));
            if (!room || room.status === 'playing') throw new Error('There is no waiting room to ready up in.');
            const member = room.members.find(p => p.username === user.username);
            member.ready = !member.ready;
            updatePlayers(room);
            if (room.members.length === 2 && room.members.every(p => p.ready && p.connected)) startGame(room);
            return {};
        }));
        socket.on('leave', handle(() => {
            leaveRoom(user.username);
            socket.emit('room_left');
            return {};
        }));
        socket.on('input', payload => {
            const room = rooms.get(membership.get(user.username));
            if (room?.status === 'playing') room.game.input(user.username, payload);
        });
        socket.on('cheat', () => {
            const room = rooms.get(membership.get(user.username));
            if (room?.status === 'playing') room.game.toggleCheat(user.username);
        });
        socket.on('disconnect', () => {
            if (connections.get(user.username) !== socket) return;
            connections.delete(user.username);
            if (closing) return;
            const room = rooms.get(membership.get(user.username));
            if (!room) return;
            const member = room.members.find(p => p.username === user.username);
            member.connected = false;
            member.ready = false;
            room.game?.input(user.username, { x: 0, y: 0 });
            updatePlayers(room);
            updateRooms();
            disconnectTimers.set(user.username, setTimeout(() => leaveRoom(user.username), 15000));
        });
    });

    let previous = Date.now();
    let snapshots = 0;
    const interval = setInterval(() => {
        const now = Date.now();
        const dt = (now - previous) / 1000;
        previous = now;
        for (const room of rooms.values()) {
            if (room.status !== 'playing') continue;
            room.game.step(dt, now);
            if (room.game.events.length) io.to(room.code).emit('game_events', room.game.events.splice(0));
            if (room.game.result) finalize(room);
            else if (snapshots % 2 === 0) io.to(room.code).emit('game_state', room.game.snapshot(now));
        }
        snapshots++;
    }, 1000 / 40);

    return { app, httpServer, io, rooms, accounts,
        close: () => new Promise(resolve => {
            closing = true;
            clearInterval(interval);
            disconnectTimers.forEach(clearTimeout);
            io.close(() => resolve());
        })
    };
}

if (require.main === module) {
    const game = createGameServer();
    game.httpServer.on('error', error => {
        console.error(error.code === 'EADDRINUSE' ? 'Port 8000 is already in use. Stop the other server and try again.' : error.message);
        game.close().finally(() => { process.exitCode = 1; });
    });
    game.httpServer.listen(8000, () => console.log('Campus Courier Clash is ready at http://localhost:8000'));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => game.close().then(() => process.exit(0)));
}

module.exports = { createGameServer };
