/* global Sprite */
// Original canvas map and artwork; entity animation uses Lab 3's Sprite module.
const CampusRenderer = (function() {
    const colors = { ink: '#294e3e', blue: '#5198bb', coral: '#d5856f' };
    const rounded = (ctx, x, y, w, h, r, fill, stroke) => {
        ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    };
    function label(ctx, text, x, y, size = 11, color = colors.ink, weight = 600) {
        ctx.fillStyle = color; ctx.font = `${weight} ${size}px "Avenir Next", sans-serif`;
        ctx.textAlign = 'center'; ctx.fillText(text, x, y);
    }
    function tree(ctx, x, y, scale = 1) {
        ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
        rounded(ctx, -22, -12, 48, 39, 16, '#7d9b6630');
        ctx.fillStyle = '#8c7954'; ctx.fillRect(-4, 1, 8, 24);
        rounded(ctx, -24, -29, 48, 43, 18, '#6f945d');
        rounded(ctx, -20, -33, 39, 35, 14, '#89a96c');
        rounded(ctx, -14, -29, 24, 23, 10, '#9cb978');
        ctx.restore();
    }
    function planter(ctx, x, y, width = 58) {
        rounded(ctx, x + 3, y + 4, width, 18, 5, '#71895b25');
        rounded(ctx, x, y, width, 17, 4, '#bbad88');
        rounded(ctx, x + 4, y - 4, width - 8, 15, 5, '#6c945f');
        for (let i = 10; i < width - 4; i += 12) {
            ctx.fillStyle = i % 3 ? '#e7b18b' : '#e9d798'; ctx.beginPath(); ctx.arc(x + i, y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
    }
    function bench(ctx, x, y) {
        rounded(ctx, x, y + 4, 49, 15, 3, '#6a795a20');
        ctx.fillStyle = '#6b7157'; ctx.fillRect(x + 7, y + 7, 4, 14); ctx.fillRect(x + 38, y + 7, 4, 14);
        rounded(ctx, x, y, 49, 8, 2, '#ba9865'); rounded(ctx, x, y + 10, 49, 7, 2, '#caaa77');
    }
    function drawBuilding(ctx, o) {
        rounded(ctx, o.x + 7, o.y + 12, o.w, o.h, 11, '#6c805c25');
        if (o.type === 'fountain') {
            rounded(ctx, o.x, o.y, o.w, o.h, 28, '#a4ad8b', '#889c7b');
            rounded(ctx, o.x + 7, o.y + 7, o.w - 14, o.h - 14, 24, '#83b5b3');
            ctx.strokeStyle = '#c0ded0'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, 22, 16, 0, 0, Math.PI * 2); ctx.stroke();
            rounded(ctx, o.x + 33, o.y + 27, 14, 34, 5, '#d1d5b7');
            rounded(ctx, o.x + 24, o.y + 23, 32, 10, 5, '#e5e3c7');
            return;
        }
        if (o.type === 'garden') {
            rounded(ctx, o.x, o.y, o.w, o.h, 9, '#b4bc90', '#93a17c');
            for (let y = o.y + 13; y < o.y + o.h - 8; y += 23) {
                rounded(ctx, o.x + 12, y, o.w - 24, 14, 4, '#9b8d60');
                for (let x = o.x + 21; x < o.x + o.w - 13; x += 20) {
                    rounded(ctx, x, y - 2, 13, 11, 5, '#6b9a65');
                    ctx.fillStyle = '#b7c786'; ctx.fillRect(x + 3, y - 1, 4, 4);
                }
            }
            if (o.label) label(ctx, o.label, o.x + o.w / 2, o.y + o.h + 18, 9, '#6b7c58', 700);
            return;
        }
        const cafe = o.type === 'cafe';
        rounded(ctx, o.x, o.y + 12, o.w, o.h - 12, 6, cafe ? '#e0c3a0' : '#d3c6a6', '#a99e7e');
        rounded(ctx, o.x - 4, o.y - 2, o.w + 8, o.h - 30, 8, cafe ? '#d9a28b' : '#9aa892', cafe ? '#b88873' : '#7e9277');
        rounded(ctx, o.x + 10, o.y + 10, o.w - 20, o.h - 53, 5, cafe ? '#e8b59a' : '#b0bea0');
        ctx.strokeStyle = cafe ? '#cd9880' : '#9dad8e';
        for (let x = o.x + 21; x < o.x + o.w; x += 23) {
            ctx.beginPath(); ctx.moveTo(x, o.y + 12); ctx.lineTo(x, o.y + o.h - 46); ctx.stroke();
        }
        for (let x = o.x + 19; x < o.x + o.w - 13; x += 34) {
            rounded(ctx, x, o.y + o.h - 29, 19, 15, 2, '#6e8d81', '#a7b49a');
            ctx.fillStyle = '#a8c0aa'; ctx.fillRect(x + 2, o.y + o.h - 27, 6, 10);
        }
        rounded(ctx, o.x + o.w / 2 - 17, o.y + o.h - 34, 34, 35, 3, '#879b85');
        rounded(ctx, o.x + o.w / 2 - 13, o.y + o.h - 29, 26, 24, 2, '#436f68');
        label(ctx, o.label, o.x + o.w / 2, o.y + 43, 11, cafe ? '#8c604b' : '#526d54', 800);
        if (cafe) {
            ctx.fillStyle = '#f7e6c8'; ctx.fillRect(o.x + 17, o.y + o.h - 41, o.w - 34, 8);
            for (let x = o.x + 17; x < o.x + o.w - 17; x += 20) {
                ctx.fillStyle = '#b97761'; ctx.fillRect(x, o.y + o.h - 41, 10, 8);
            }
        }
    }
    function drawMap(canvas, map) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#dce7d0'; ctx.fillRect(0, 0, 1200, 720);
        ctx.fillStyle = '#d1dfc1'; ctx.fillRect(16, 16, 1168, 688);
        rounded(ctx, 32, 32, 1136, 656, 18, '#dce7ce', '#b8c9a7');
        // The paths and courtyard connect both delivery desks symmetrically.
        rounded(ctx, 42, 295, 1116, 130, 16, '#eee9d7', '#d5d4bc');
        rounded(ctx, 168, 44, 76, 632, 12, '#eee9d7', '#d5d4bc');
        rounded(ctx, 956, 44, 76, 632, 12, '#eee9d7', '#d5d4bc');
        rounded(ctx, 520, 208, 160, 313, 18, '#eee9d7', '#d5d4bc');
        ctx.fillStyle = '#eee9d7'; ctx.fillRect(170, 297, 72, 126); ctx.fillRect(958, 297, 72, 126); ctx.fillRect(522, 297, 156, 126);
        ctx.setLineDash([5, 10]); ctx.strokeStyle = '#d0cdb58a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(260, 360); ctx.lineTo(940, 360); ctx.stroke(); ctx.setLineDash([]);
        // Seeded speckles give the grass a printed texture without external art.
        let seed = 72;
        for (let i = 0; i < 740; i++) {
            seed = (seed * 16807) % 2147483647; const x = seed % 1150 + 25;
            seed = (seed * 16807) % 2147483647; const y = seed % 660 + 30;
            if ((y > 290 && y < 430) || (x > 160 && x < 250) || (x > 950 && x < 1040) || (x > 510 && x < 690)) continue;
            ctx.fillStyle = i % 3 ? '#b9cd9c65' : '#9eb58445'; ctx.fillRect(x, y, 3, 2);
        }
        // Courtyard paving tiles.
        ctx.strokeStyle = '#dedcc84a'; ctx.lineWidth = 1;
        for (let x = 72; x < 1140; x += 35) { ctx.beginPath(); ctx.moveTo(x, 303); ctx.lineTo(x, 417); ctx.stroke(); }
        for (let y = 315; y < 420; y += 32) { ctx.beginPath(); ctx.moveTo(48, y); ctx.lineTo(1152, y); ctx.stroke(); }
        map.obstacles.forEach(o => drawBuilding(ctx, o));
        for (const [x, y, s] of [[86,90,1.1],[125,165,.85],[89,242,.8],[1110,91,1.1],[1074,166,.85],[1115,242,.8],[91,520,.9],[128,602,1.1],[1105,525,.9],[1072,608,1.1],[284,661,.6],[344,666,.65],[858,666,.65],[919,659,.6],[425,64,.65],[774,64,.65],[484,594,.55],[714,594,.55]]) tree(ctx,x,y,s);
        planter(ctx, 300, 248, 73); planter(ctx, 828, 248, 73);
        planter(ctx, 300, 457, 55); planter(ctx, 848, 457, 55);
        bench(ctx, 390, 242); bench(ctx, 762, 242);
        bench(ctx, 445, 465); bench(ctx, 707, 465);
        label(ctx, 'NORTH QUAD', 600, 60, 13, '#8c9e77', 800);
        label(ctx, 'MAKE EVERY TRIP COUNT', 600, 680, 9, '#91a17e', 700);
        // Small decorative bike stands; kept outside movement lanes.
        for (const x of [260, 940]) {
            ctx.strokeStyle = '#8b9d79'; ctx.lineWidth = 3;
            for (let y = 525; y < 605; y += 25) { ctx.beginPath(); ctx.roundRect(x - 5, y, 10, 15, 4); ctx.stroke(); }
        }
    }

    class Renderer {
        constructor(canvas, map) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.map = map;
            this.background = document.createElement('canvas');
            this.background.width = 1200; this.background.height = 720;
            drawMap(this.background, map);
            this.sprites = new Map();
            this.positions = new Map();
            this.particles = [];
            this.lastTime = 0;
            this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }

        reset() { this.positions.clear(); this.sprites.clear(); this.particles = []; }

        sprite(key, source, x, y, scale, time, moving = true) {
            let entity = this.sprites.get(key);
            if (!entity) {
                entity = { sprite: Sprite(this.ctx, x, y).useSheet(`/assets/${source}.svg`)
                    .setScale(scale).setShadowScale({ x: .44, y: .07 }), moving: null };
                this.sprites.set(key, entity);
            }
            if (entity.moving !== moving) {
                entity.sprite.setSequence({ x: 0, y: 0, width: 64, height: 64,
                    count: this.reducedMotion && !moving ? 1 : 4, timing: moving ? 130 : 450, loop: true });
                entity.moving = moving;
            }
            entity.sprite.setXY(x, y).update(time).draw();
        }

        position(key, entity, factor) {
            const previous = this.positions.get(key);
            const next = previous && Math.hypot(previous.x - entity.x, previous.y - entity.y) < 180
                ? { x: previous.x + (entity.x - previous.x) * factor, y: previous.y + (entity.y - previous.y) * factor }
                : { x: entity.x, y: entity.y };
            this.positions.set(key, next);
            return next;
        }

        effect(event, time) {
            if (!['pickup', 'delivery', 'collision', 'hit', 'boost', 'cheat'].includes(event.type)) return;
            const color = event.type === 'collision' || event.type === 'hit' ? '#d47d61' : event.type === 'boost' ? '#7ca56c' : '#dfb55f';
            this.particles.push({ x: event.x, y: event.y - 20, start: time,
                text: event.type === 'delivery' ? `+${event.count} DELIVERED` : event.type === 'boost' ? 'SPEED UP!' : event.type === 'cheat' ? event.enabled ? 'CHEAT ON' : 'CHEAT OFF' : '', color });
        }

        render(state, time, username, preview = false) {
            const ctx = this.ctx;
            const dt = this.lastTime ? Math.min(100, time - this.lastTime) : 16;
            this.lastTime = time;
            const factor = preview ? 1 : 1 - Math.exp(-dt / 38);
            const now = state.now;
            ctx.clearRect(0, 0, 1200, 720);
            ctx.drawImage(this.background, 0, 0);
            this.map.desks.forEach((desk, i) => {
                const color = i === 0 ? colors.blue : colors.coral;
                const pulse = this.reducedMotion ? 0 : Math.sin(time / 500) * 3;
                rounded(ctx, desk.x - 49 - pulse, desk.y - 48 - pulse, 98 + pulse * 2, 96 + pulse * 2, 15, i === 0 ? '#9ac4cf25' : '#e0a88a25');
                ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
                ctx.beginPath(); ctx.roundRect(desk.x - 46, desk.y - 46, 92, 92, 12); ctx.stroke(); ctx.setLineDash([]);
                rounded(ctx, desk.x - 32, desk.y - 20, 64, 43, 6, i === 0 ? '#669bae' : '#c7876d', i === 0 ? '#447b91' : '#aa6c57');
                rounded(ctx, desk.x - 35, desk.y - 26, 70, 14, 4, i === 0 ? '#9bc4cf' : '#e6b397');
                rounded(ctx, desk.x - 11, desk.y - 32, 22, 8, 2, '#f7e5bb');
                label(ctx, 'DROP OFF', desk.x, desk.y + 9, 9, '#fff7e6', 800);
                label(ctx, i === 0 ? 'BLUE DISPATCH' : 'CORAL DISPATCH', desk.x, desk.y + 65, 8, i === 0 ? '#577e8e' : '#a57a67', 800);
            });
            // Robots' subtle safety markings make their paths legible.
            ctx.setLineDash([3, 9]); ctx.strokeStyle = '#a4b68f44'; ctx.lineWidth = 2;
            for (const robot of state.robots) {
                ctx.beginPath();
                if (robot.axis === 'x') { ctx.moveTo(robot.min, robot.y); ctx.lineTo(robot.max, robot.y); }
                else { ctx.moveTo(robot.x, robot.min); ctx.lineTo(robot.x, robot.max); }
                ctx.stroke();
            }
            ctx.setLineDash([]);
            for (const boost of state.boosts) {
                if (now < boost.readyAt) continue;
                this.sprite(`b${boost.id}`, 'boost', boost.x, boost.y, .59, time);
            }
            for (const parcel of state.parcels) {
                if (now < parcel.availableAt) continue;
                this.sprite(`c${parcel.id}`, 'parcel', parcel.x, parcel.y - 3, .54, time + parcel.id * 97);
            }
            const entities = [...state.robots.map(p => ({ ...p, type: 'robot' })), ...state.players.map(p => ({ ...p, type: 'player' }))].sort((a, b) => a.y - b.y);
            for (const entity of entities) {
                const key = entity.type === 'player' ? `p${entity.username}` : `r${entity.id}`;
                const pos = this.position(key, entity, factor);
                if (entity.type === 'robot') {
                    ctx.fillStyle = '#eabf6c22'; ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 8, 30, 19, 0, 0, Math.PI * 2); ctx.fill();
                    this.sprite(key, 'robot', pos.x, pos.y, .78, time + entity.id * 123);
                    continue;
                }
                const player = entity;
                const local = player.username === username;
                const teamColor = player.team === 0 ? colors.blue : colors.coral;
                if (now < player.dashUntil) {
                    ctx.fillStyle = player.team === 0 ? '#6da8bf50' : '#d8a18450';
                    for (let i = 1; i <= 3; i++) {
                        const dx = [0, 1, 0, -1, 0][player.facing];
                        const dy = [0, 0, 1, 0, -1][player.facing];
                        rounded(ctx, pos.x + dx * i * 16 - 13, pos.y + dy * i * 16 - 12, 26, 22, 10, ctx.fillStyle);
                    }
                }
                if (player.cheat || now < player.boostUntil || local) {
                    ctx.strokeStyle = player.cheat ? '#a6c85c' : now < player.boostUntil ? '#85ad5d' : teamColor;
                    ctx.lineWidth = player.cheat ? 3 : 1.5;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y + 21, 24, 10, 0, 0, Math.PI * 2); ctx.stroke();
                }
                ctx.save();
                if (now < player.immuneUntil && !player.cheat) ctx.globalAlpha = .55 + Math.sin(time / 60) * .2;
                this.sprite(key, `courier-${player.team === 0 ? 'blue' : 'coral'}`, pos.x, pos.y - 7, .94, time, player.moving);
                ctx.restore();
                const name = preview ? player.team === 0 ? 'YOU' : 'YOUR RIVAL' : player.name + (local ? ' · YOU' : '');
                ctx.font = '700 10px "Avenir Next", sans-serif';
                const labelWidth = Math.max(45, ctx.measureText(name).width + 16);
                rounded(ctx, pos.x - labelWidth / 2, pos.y - 52, labelWidth, 18, 5, local ? '#224d3fee' : '#fffdf2ed');
                label(ctx, name, pos.x, pos.y - 39, 10, local ? '#fff6e5' : '#557251', 700);
                if (now < player.stunUntil) {
                    label(ctx, '✦  ✦  ✦', pos.x, pos.y - 24 + Math.sin(time / 100) * 2, 14, '#c18b3c', 800);
                }
                for (let i = 0; i < player.carrying; i++) {
                    rounded(ctx, pos.x + (i - (player.carrying - 1) / 2) * 11 - 4, pos.y + 30, 8, 7, 1, '#e6bc6d', '#b29152');
                    ctx.fillStyle = '#fff0bb'; ctx.fillRect(pos.x + (i - (player.carrying - 1) / 2) * 11 - 1, pos.y + 30, 2, 7);
                }
                if (player.cheat) label(ctx, 'CHEAT', pos.x, pos.y + 52, 8, '#7b943a', 800);
            }
            this.particles = this.particles.filter(p => time - p.start < 1000);
            for (const particle of this.particles) {
                const progress = (time - particle.start) / 1000;
                ctx.save(); ctx.globalAlpha = 1 - progress;
                for (let i = 0; i < 7; i++) {
                    const angle = i * Math.PI * 2 / 7;
                    ctx.fillStyle = particle.color;
                    ctx.fillRect(particle.x + Math.cos(angle) * progress * 45, particle.y + Math.sin(angle) * progress * 35 - progress * 20, 4, 4);
                }
                if (particle.text) label(ctx, particle.text, particle.x, particle.y - progress * 45, 11, particle.color, 800);
                ctx.restore();
            }
            // Remove obsolete parcel Sprite objects after collection, avoiding
            // image accumulation during many consecutive rematches.
            if (this.sprites.size > 120) {
                const active = new Set(state.parcels.map(p => `c${p.id}`));
                for (const key of this.sprites.keys()) if (key.startsWith('c') && !active.has(key)) this.sprites.delete(key);
            }
        }
    }
    return Renderer;
})();
