/* global CampusRenderer */
// Lab 3's requestAnimationFrame update/draw loop and keyboard controls, adapted
// to render shared server snapshots instead of moving a local-only player.
const CourierGame = (function() {
    let renderer, previewRenderer, map, rules, socket, user, state;
    let running = false, receivedAt = 0, lastHud = 0;
    const held = new Set();
    let sound = localStorage.getItem('courier-sound') !== 'off';
    const lastSound = new Map();
    const $ = id => document.getElementById(id);
    const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

    function play(name) {
        if (!sound || performance.now() - (lastSound.get(name) || -1000) < 70) return;
        lastSound.set(name, performance.now());
        const audio = $(`audio-${name}`);
        if (!audio) return;
        audio.volume = .3;
        audio.currentTime = 0;
        const promise = audio.play();
        if (promise) promise.catch(() => {});
    }

    function soundButton() {
        $('sound-button').setAttribute('aria-pressed', String(sound));
        $('sound-button').querySelector('span').textContent = sound ? 'Sound on' : 'Sound off';
    }

    function sendInput(dash = false) {
        if (!running || !socket?.connected) return;
        socket.emit('input', {
            x: Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft')),
            y: Number(held.has('KeyS') || held.has('ArrowDown')) - Number(held.has('KeyW') || held.has('ArrowUp')),
            dash
        });
    }
    function clearInput() { held.clear(); sendInput(); }

    function updateHud(now) {
        const player = state.players.find(p => p.username === user?.username);
        if (!player) return;
        for (const courier of state.players) {
            const color = courier.team === 0 ? 'blue' : 'coral';
            $(`${color}-name`).textContent = courier.name;
            $(`${color}-score`).textContent = courier.score;
            $(`${color}-tag`).textContent = `${color.toUpperCase()} COURIER${courier.username === user.username ? ' · YOU' : ''}`;
        }
        const countdown = Math.max(0, Math.ceil((state.startsAt - now) / 1000));
        $('countdown-overlay').classList.toggle('hidden', countdown === 0);
        $('countdown-number').textContent = countdown;
        const remaining = Math.max(0, Math.min(rules.duration, Math.ceil((state.endsAt - now) / 1000)));
        $('match-timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
        $('match-timer').parentElement.classList.toggle('urgent', remaining <= 30);
        $('match-phase').textContent = state.cheated ? 'PRACTICE · CHEAT USED' : 'FIRST TO 12';
        $('bag-count').textContent = `${player.carrying} / ${rules.capacity}`;
        [...$('bag-slots').children].forEach((slot, i) => slot.classList.toggle('filled', i < player.carrying));
        const cooldown = Math.max(0, (player.dashReadyAt - now) / 1000);
        $('dash-status').textContent = cooldown ? `${cooldown.toFixed(1)}s` : 'Ready';
        $('dash-meter-fill').style.width = `${Math.max(0, 1 - cooldown / rules.dashCooldown) * 100}%`;
        $('cheat-banner').classList.toggle('hidden', !player.cheat);
        $('touch-cheat').setAttribute('aria-pressed', String(player.cheat));
        $('player-status').textContent = now < player.stunUntil ? 'Robot trouble! You’ll be moving in a moment.'
            : player.cheat ? 'Express service: deliver one parcel to win.'
            : now < player.boostUntil ? 'Speed boost! Make those five seconds count.'
            : player.carrying === rules.capacity ? 'Bag full! Head to your colored desk.'
            : player.carrying ? 'The goods are in. Head home or grab another.' : 'Grab a parcel. Make a move.';
    }

    function preview(time) {
        const t = time / 1000;
        const now = Date.now();
        const blueX = 330 + Math.sin(t * .42) * 100;
        const coralX = 860 + Math.sin(t * .38 + 2) * 80;
        const player = (username, team, x, y) => ({ username, name: username, team, x, y,
            moving: true, facing: team === 0 ? 3 : 1, carrying: team === 0 ? 2 : 1,
            dashUntil: 0, immuneUntil: 0, stunUntil: 0, boostUntil: 0, cheat: false });
        return { now, players: [player('preview-blue', 0, blueX, 350), player('preview-coral', 1, coralX, 395)],
            parcels: map.pickups.map((p, i) => ({ ...p, id: i, availableAt: 0 })),
            boosts: map.boosts.map((p, i) => ({ ...p, id: i, readyAt: 0 })),
            robots: [
                { id: 0, x: 600 + Math.sin(t * .4) * 220, y: 270, axis: 'x', min: 330, max: 870 },
                { id: 1, x: 600 - Math.sin(t * .4) * 220, y: 450, axis: 'x', min: 330, max: 870 },
                { id: 2, x: 600, y: 340 + Math.sin(t * .7) * 100, axis: 'y', min: 240, max: 480 }
            ] };
    }

    function frame(time) {
        if (running && state && renderer) {
            const now = state.now + Math.max(0, time - receivedAt);
            renderer.render({ ...state, now }, time, user.username);
            if (time - lastHud > 50) { updateHud(now); lastHud = time; }
        } else if (previewRenderer && !$('home-page').classList.contains('hidden')) {
            previewRenderer.render(preview(time), time, null, true);
        }
        requestAnimationFrame(frame);
    }

    function init(config) {
        map = config.map; rules = config.rules;
        renderer = new CampusRenderer($('game-canvas'), map);
        previewRenderer = new CampusRenderer($('preview-canvas'), map);
        soundButton();
        $('sound-button').addEventListener('click', () => {
            sound = !sound;
            localStorage.setItem('courier-sound', sound ? 'on' : 'off');
            if (!sound) document.querySelectorAll('audio').forEach(audio => audio.pause());
            soundButton();
        });
        document.addEventListener('keydown', event => {
            if (!running || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
            if (movementCodes.has(event.code)) {
                event.preventDefault(); held.add(event.code); sendInput();
            } else if (event.code === 'Space') {
                event.preventDefault(); if (!event.repeat) sendInput(true);
            } else if (event.code === 'KeyC') {
                event.preventDefault(); if (!event.repeat) socket?.emit('cheat');
            }
        });
        document.addEventListener('keyup', event => {
            if (movementCodes.has(event.code)) { held.delete(event.code); sendInput(); }
        });
        window.addEventListener('blur', clearInput);
        document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
        document.querySelectorAll('[data-move]').forEach(button => {
            const code = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[button.dataset.move];
            button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); held.add(code); sendInput(); });
            for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => { held.delete(code); sendInput(); });
        });
        $('touch-dash').addEventListener('pointerdown', event => { event.preventDefault(); sendInput(true); });
        $('touch-cheat').addEventListener('click', () => socket?.emit('cheat'));
        setInterval(() => sendInput(), 100);
        requestAnimationFrame(frame);
    }

    function bind(connection, currentUser) { socket = connection; user = currentUser; }
    function start(payload) {
        state = payload.state; rules = payload.rules;
        receivedAt = performance.now(); lastHud = 0;
        running = true; held.clear(); renderer.reset();
        $('game-canvas').focus({ preventScroll: true });
        updateHud(state.now);
    }
    function update(snapshot) {
        if (!running || snapshot.id !== state?.id) return;
        state = snapshot; receivedAt = performance.now();
    }
    function events(items) {
        if (!running) return;
        for (const event of items) {
            renderer.effect(event, performance.now());
            if (event.username === user.username) {
                const name = ({ pickup: 'pickup', collision: 'collision', dash: 'dash', boost: 'pickup', delivery: 'delivery', hit: 'collision' })[event.type];
                if (name) play(name);
            } else if (event.victim === user.username) play('collision');
        }
    }
    function stop(finished = false) { clearInput(); running = false; if (finished) play('finish'); }
    function connectionMessage(message) {
        $('game-connection-message').textContent = message;
        $('game-connection-message').classList.toggle('hidden', !message);
        if (message) clearInput();
    }
    return { init, bind, start, update, events, stop, clearInput, connectionMessage };
})();
