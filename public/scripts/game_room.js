/* global io, CourierGame */
// Adapted from Lab 5's GameRoom IIFE: init/validate, registration confirmation,
// fetch-based sign-in and sign-out, and switching between account pages.
// The room/ready/game_start/game_end handlers extend Lab 6's HandGame module.
const GameRoom = (function() {
    const $ = id => document.getElementById(id);
    let user = null, socket = null, room = null, page = 'home', config;
    let toastTimer;
    function show(id, visible) { $(id).classList.toggle('hidden', !visible); }
    function toast(message) {
        $('toast').textContent = message; show('toast', true);
        clearTimeout(toastTimer); toastTimer = setTimeout(() => show('toast', false), 3500);
    }
    function changePage(next) {
        page = next;
        for (const name of ['home', 'game', 'results']) show(`${name}-page`, name === next);
        if (next !== 'game') CourierGame.stop();
        window.scrollTo({ top: 0, behavior: 'instant' });
    }
    function authTab(register) {
        show('register-form', register); show('signin-form', !register);
        $('signin-tab').setAttribute('aria-selected', String(!register));
        $('register-tab').setAttribute('aria-selected', String(register));
        $('register-message').textContent = ''; $('signin-message').textContent = '';
    }
    async function request(url, body) {
        const response = await fetch(url, body === undefined ? undefined : {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        let result;
        try { result = await response.json(); } catch { throw new Error('Dispatch could not respond. Please try again.'); }
        if (!response.ok || result.error) throw new Error(result.error || 'The request could not be completed.');
        return result;
    }
    function emit(name, payload = {}) {
        return new Promise((resolve, reject) => {
            if (!socket?.connected) return reject(new Error('Not connected to dispatch. Please wait for reconnection.'));
            socket.timeout(5000).emit(name, payload, (error, response) => {
                if (error) reject(new Error('Dispatch took too long to respond. Please try again.'));
                else if (response.error) reject(new Error(response.error));
                else resolve(response);
            });
        });
    }
    async function pending(button, action, messageId) {
        if (button.disabled) return;
        button.disabled = true;
        if (messageId) $(messageId).textContent = '';
        try { await action(); }
        catch (error) { if (messageId) $(messageId).textContent = error.message; else toast(error.message); }
        finally { button.disabled = false; }
    }
    function authView() {
        show('auth-panel', !user); show('signout-button', Boolean(user));
        show('matchmaking-panel', Boolean(user) && !room); show('waiting-panel', Boolean(user) && Boolean(room));
        if (user) $('welcome-name').textContent = `${user.name}.`;
    }
    function empty(text, heading) {
        const div = document.createElement('div'); div.className = 'empty-state';
        if (heading) { const b = document.createElement('b'); b.textContent = heading; div.append(b); }
        div.append(document.createTextNode(text)); return div;
    }
    function leaderboard(players) {
        for (const id of ['home-leaderboard', 'results-leaderboard']) {
            const parent = $(id); parent.replaceChildren();
            if (!players.length) { parent.append(empty('Finish a ranked shift to put your name on the board.', 'The next campus legend could be you.')); continue; }
            const table = document.createElement('table'); table.className = 'leaderboard-table';
            const header = table.createTHead().insertRow();
            for (const title of ['RANK', 'COURIER', 'WINS', 'DELIVERED', 'PLAYED', 'DRAWS']) {
                const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = title; header.append(cell);
            }
            const body = table.createTBody();
            for (const player of players) {
                const row = body.insertRow();
                if (player.username === user?.username) row.className = 'you';
                const rank = row.insertCell(); rank.className = 'rank'; rank.textContent = String(player.rank).padStart(2, '0');
                const name = row.insertCell(); name.className = 'table-name'; name.textContent = player.name;
                const handle = document.createElement('small'); handle.textContent = `@${player.username}${player.username === user?.username ? ' · YOU' : ''}`; name.append(handle);
                for (const value of [player.wins, player.delivered, player.played, player.draws]) row.insertCell().textContent = value;
            }
            parent.append(table);
        }
    }
    async function refreshLeaderboard() {
        try { leaderboard((await request('/api/leaderboard')).players); }
        catch (error) { $('home-leaderboard').replaceChildren(empty(error.message)); }
    }
    function openRooms(rooms) {
        const list = $('open-rooms-list'); list.replaceChildren();
        if (!rooms.length) {
            const text = document.createElement('p'); text.className = 'muted small'; text.textContent = 'No open shifts yet. Start one above.'; list.append(text);
        }
        for (const open of rooms) {
            const button = document.createElement('button'); button.className = 'open-room';
            const name = document.createElement('span'); name.textContent = `${open.host}’s shift`;
            const code = document.createElement('span'); code.textContent = `${open.code} →`;
            button.append(name, code);
            button.addEventListener('click', () => pending(button, () => emit('join', { code: open.code }), 'room-message'));
            list.append(button);
        }
    }
    function updatePlayers(next) {
        room = next; authView();
        $('waiting-code').textContent = room.code;
        $('game-room-label').textContent = `ROOM ${room.code}`;
        const waiting = $('waiting-players'); waiting.replaceChildren();
        room.members.forEach((member, i) => {
            const div = document.createElement('div'); div.className = 'waiting-player';
            const avatar = document.createElement('img'); avatar.src = `/assets/courier-${i === 0 ? 'blue' : 'coral'}-icon.svg`; avatar.alt = '';
            const identity = document.createElement('div'); const name = document.createElement('strong'); name.textContent = member.name;
            const sub = document.createElement('small'); sub.textContent = member.username === user.username ? 'That’s you' : 'Your friendly rival'; identity.append(name, sub);
            const status = document.createElement('span'); status.className = `ready-chip${member.ready ? ' is-ready' : ''}`;
            status.textContent = !member.connected ? 'Reconnecting' : member.ready ? 'Ready ✓' : 'Not ready';
            div.append(avatar, identity, status); waiting.append(div);
        });
        if (room.members.length < 2) { const text = document.createElement('div'); text.className = 'waiting-empty'; text.textContent = '+ Waiting for courier two…'; waiting.append(text); }
        const me = room.members.find(member => member.username === user.username);
        $('ready-button').textContent = me?.ready ? 'Not ready yet' : 'Ready for delivery →';
        const allConnected = room.members.length === 2 && room.members.every(member => member.connected);
        $('waiting-message').textContent = !allConnected ? 'Share the code and wait for your rival.' : me?.ready ? 'You’re ready. Waiting for your rival…' : 'Two couriers checked in. Ready when you are.';
        if (page === 'game') {
            const disconnected = room.members.find(member => !member.connected);
            CourierGame.connectionMessage(disconnected ? `${disconnected.name} lost connection. Waiting up to 15 seconds for them to return…` : '');
        }
        if (page === 'results') {
            $('rematch-button').disabled = !allConnected;
            $('rematch-button').textContent = me?.ready ? 'Cancel rematch request' : 'Run it back ↻';
            $('rematch-message').textContent = !allConnected ? 'Your rival has left. Head back to dispatch for another shift.' : me?.ready ? 'Rematch requested. Waiting for your rival…' : room.members.some(member => member.ready) ? 'Your rival wants a rematch. Ready for another?' : '';
        }
    }
    function results(result) {
        CourierGame.stop(true); changePage('results');
        const winner = result.players.find(p => p.username === result.winner);
        const me = result.players.find(p => p.username === user.username);
        const opponent = result.players.find(p => p.username !== user.username);
        const outcome = result.reason === 'cancelled' ? 'cancelled' : !winner ? 'draw' : winner.username === user.username ? 'win' : 'loss';
        const presentation = {
            win: { title: 'YOU WIN!', stamp: '★' },
            loss: { title: 'YOU LOSE', stamp: '×' },
            draw: { title: "IT’S A DRAW", stamp: '=' },
            cancelled: { title: 'MATCH CANCELLED', stamp: '—' }
        }[outcome];
        $('results-page').dataset.outcome = outcome;
        $('result-title').textContent = presentation.title;
        $('result-stamp').textContent = presentation.stamp;
        $('result-perspective').textContent = `YOUR RESULT · ${user.name} · ${me?.team === 0 ? 'BLUE' : 'CORAL'} COURIER`;
        $('result-winner').textContent = winner
            ? `Winner: ${winner.name} (@${winner.username})${outcome === 'win' ? ' · That’s you!' : ''}`
            : outcome === 'cancelled' ? 'No winner. Start a new shift to play again.' : 'No winner. You share this result.';
        const ending = result.reason === 'disconnect'
            ? outcome === 'win' ? `${opponent.name} left the shift. You win by forfeit.` : `You left the shift. ${winner.name} wins by forfeit.`
            : outcome === 'cancelled' ? 'The shift ended before both couriers could finish.'
            : outcome === 'draw' && result.reason === 'delivery' ? 'Both couriers reached the delivery target together.'
            : outcome === 'draw' ? `Both couriers finished on ${me.score} points.`
            : `You scored ${me.score}. ${opponent.name} scored ${opponent.score}.`;
        $('result-subtitle').textContent = `${ending} ${Math.floor(result.duration / 60)}m ${result.duration % 60}s on the clock.`;
        $('result-badge').textContent = result.cheated ? 'PRACTICE SHIFT · CHEAT USED · RANKINGS UNCHANGED' : result.reason === 'cancelled' ? 'CANCELLED · RANKINGS UNCHANGED' : 'RANKED SHIFT · LEADERBOARD UPDATED';
        $('result-badge').classList.toggle('practice', result.cheated || result.reason === 'cancelled');
        const summary = $('result-summary'); summary.replaceChildren();
        for (const player of result.players) {
            const isYou = player.username === user.username;
            const isWinner = player.username === result.winner;
            const card = document.createElement('article'); card.className = `result-player ${player.team === 1 ? 'coral-team' : 'blue-team'}${isWinner ? ' winner' : ''}${isYou ? ' is-you' : ''}`;
            const labels = document.createElement('div'); labels.className = 'result-card-labels';
            const placement = document.createElement('span'); placement.className = 'result-placement';
            placement.textContent = outcome === 'cancelled' ? 'NO RESULT' : outcome === 'draw' ? 'DRAW' : isWinner ? '★ WINNER' : 'RUNNER-UP';
            labels.append(placement);
            if (isYou) { const you = document.createElement('span'); you.className = 'result-you'; you.textContent = 'YOU'; labels.append(you); }
            const image = document.createElement('img'); image.src = `/assets/courier-${player.team === 0 ? 'blue' : 'coral'}-icon.svg`; image.alt = '';
            const name = document.createElement('h3'); name.textContent = player.name;
            const role = document.createElement('p'); role.textContent = `${player.team === 0 ? 'BLUE' : 'CORAL'} COURIER · @${player.username}`;
            const points = document.createElement('div'); points.className = 'result-points';
            const score = document.createElement('b'); score.textContent = player.score; points.append(score, document.createTextNode('points delivered'));
            card.append(labels, image, name, role, points); summary.append(card);
        }
        const table = document.createElement('table'); table.className = 'stats-table';
        const head = table.createTHead().insertRow();
        for (const text of ['SHIFT STATISTIC', ...result.players.map(player => `${player.name}${player.username === user.username ? ' (you)' : ''}`)]) {
            const th = document.createElement('th'); th.scope = 'col'; th.textContent = text; head.append(th);
        }
        const body = table.createTBody();
        for (const [label, key] of [['Final score', 'score'], ['Parcels collected', 'collected'], ['Parcels delivered', 'delivered'], ['Parcels dropped', 'dropped'], ['Successful dash hits', 'hits'], ['Robot collisions', 'collisions']]) {
            const row = body.insertRow(); row.insertCell().textContent = label;
            for (const player of result.players) row.insertCell().textContent = player[key];
        }
        $('result-statistics').replaceChildren(table);
        leaderboard(result.leaderboard);
    }
    function connect() {
        if (socket) socket.disconnect();
        socket = io({ transports: ['websocket'], reconnectionDelay: 600, reconnectionDelayMax: 2000 });
        CourierGame.bind(socket, user);
        socket.on('connect', () => {
            $('connection-message').textContent = 'Dispatch is online. Find your next rival.';
            $('create-room-button').disabled = false; $('join-room-button').disabled = false;
            CourierGame.connectionMessage('');
        });
        socket.on('connect_error', error => {
            $('connection-message').textContent = error.message;
            $('create-room-button').disabled = true; $('join-room-button').disabled = true;
            if (page === 'game') CourierGame.connectionMessage(error.message);
            if (!socket.active) toast(error.message);
        });
        socket.on('disconnect', () => {
            $('connection-message').textContent = 'Connection lost. Reconnecting to dispatch…';
            $('create-room-button').disabled = true; $('join-room-button').disabled = true;
            CourierGame.connectionMessage('Connection lost. Reconnecting… Your place is held for 15 seconds.');
        });
        socket.on('rooms', openRooms);
        socket.on('update_players', updatePlayers);
        socket.on('room_left', () => { room = null; authView(); changePage('home'); refreshLeaderboard(); });
        socket.on('game_start', payload => { changePage('game'); CourierGame.start(payload); });
        socket.on('game_state', CourierGame.update);
        socket.on('game_events', CourierGame.events);
        socket.on('game_end', results);
        socket.on('leaderboard', leaderboard);
    }
    function signedIn(nextUser) {
        user = nextUser; room = null; authView(); connect(); refreshLeaderboard();
    }
    async function validate() {
        try { signedIn((await request('/validate')).user); }
        catch { user = null; authView(); }
    }
    function init() {
        $('signin-tab').addEventListener('click', () => authTab(false));
        $('register-tab').addEventListener('click', () => authTab(true));
        $('register-form').addEventListener('submit', event => {
            event.preventDefault(); const form = event.currentTarget;
            pending(form.querySelector('button'), async () => {
                const body = Object.fromEntries(new FormData(form));
                if (body.password !== body.confirmPassword) throw new Error('Passwords do not match.');
                await request('/register', body);
                authTab(false); form.reset();
                $('signin-username').value = body.username;
                $('signin-message').textContent = 'Your courier ID is ready. Sign in to start your shift.';
                $('signin-message').classList.add('success');
                $('signin-password').focus();
            }, 'register-message');
        });
        $('signin-form').addEventListener('submit', event => {
            event.preventDefault(); const form = event.currentTarget;
            $('signin-message').classList.remove('success');
            pending(form.querySelector('button'), async () => {
                signedIn((await request('/signin', Object.fromEntries(new FormData(form)))).user);
                form.reset();
            }, 'signin-message');
        });
        $('signout-button').addEventListener('click', () => {
            if (page === 'game') { $('leave-dialog').showModal(); return; }
            pending($('signout-button'), async () => {
                await request('/signout', {}); socket?.disconnect(); socket = null;
                user = null; room = null; authView(); changePage('home'); refreshLeaderboard(); toast('Clocked out. See you next shift.');
            });
        });
        $('create-room-button').addEventListener('click', () => pending($('create-room-button'), () => emit('create_room'), 'room-message'));
        $('join-form').addEventListener('submit', event => { event.preventDefault(); pending($('join-room-button'), () => emit('join', { code: $('room-code').value }), 'room-message'); });
        $('ready-button').addEventListener('click', () => pending($('ready-button'), () => emit('ready')));
        $('leave-room-button').addEventListener('click', () => pending($('leave-room-button'), () => emit('leave')));
        $('home-button').addEventListener('click', () => pending($('home-button'), () => emit('leave')));
        $('rematch-button').addEventListener('click', () => pending($('rematch-button'), () => emit('ready')));
        $('copy-code').addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(room.code); toast('Room code copied. Send it to your rival.'); }
            catch { toast(`Your room code is ${room.code}.`); }
        });
        function help() { CourierGame.clearInput(); $('help-dialog').showModal(); }
        $('help-button').addEventListener('click', help); $('all-rules-button').addEventListener('click', help);
        $('rankings-button').addEventListener('click', () => {
            if (page === 'game') { toast('Overall rankings appear when the shift ends.'); return; }
            (page === 'results' ? $('results-leaderboard') : $('leaderboard-section')).scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
        document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog && (event.offsetX < 0 || event.offsetX > dialog.clientWidth || event.offsetY < 0 || event.offsetY > dialog.clientHeight)) dialog.close(); }));
        $('exit-match-button').addEventListener('click', () => { CourierGame.clearInput(); $('leave-dialog').showModal(); });
        $('confirm-leave-button').addEventListener('click', () => pending($('confirm-leave-button'), async () => { await emit('leave'); $('leave-dialog').close(); }));
    }
    async function bootstrap() {
        try {
            config = await request('/api/config'); CourierGame.init(config); init();
            await Promise.all([validate(), refreshLeaderboard()]);
        } catch (error) { $('signin-message').textContent = `Could not reach dispatch. ${error.message} Refresh to retry.`; }
    }
    return { init: bootstrap };
})();

document.addEventListener('DOMContentLoaded', GameRoom.init);
