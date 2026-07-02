const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static('public'));

// ─── Constants ───────────────────────────────────────────────────────────────
const WORLD_WIDTH    = 2000;
const WORLD_HEIGHT   = 2000;
const PLAYER_RADIUS  = 20;
const BULLET_RADIUS  = 5;
const BULLET_SPEED   = 600;
const BULLET_DAMAGE  = 10;
const HIT_DISTANCE   = PLAYER_RADIUS + BULLET_RADIUS;
const TICK_RATE      = 30;
const BULLET_RATE_MS = 150;  // min ms between shots per player
const MAX_BULLETS    = 200;  // global safety cap

// Single source of truth for map geometry. Clients receive this on join and
// build their BlockManager from it, so layout is never duplicated or out of sync.
const BLOCK_DEFS = [
    { x: 400,  y: 400,  w: 200, h: 40  },
    { x: 1200, y: 600,  w: 120, h: 200 },
    { x: 1200, y: 320,  w: 300, h: 80  },
    { x: 280,  y: 720,  w: 360, h: 40  },
    { x: 440,  y: 560,  w: 40,  h: 360 },
    { x: 480,  y: 560,  w: 160, h: 40  },
    { x: 280,  y: 880,  w: 160, h: 40  },
    { x: 600,  y: 760,  w: 40,  h: 160 },
    { x: 280,  y: 560,  w: 40,  h: 160 },
];

const GAME_CONFIG = { worldWidth: WORLD_WIDTH, worldHeight: WORLD_HEIGHT, blockDefs: BLOCK_DEFS };

// ─── State ───────────────────────────────────────────────────────────────────
const players = {};
const bullets  = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randomSpawn() {
    return {
        x: 200 + Math.random() * (WORLD_WIDTH  - 400),
        y: 200 + Math.random() * (WORLD_HEIGHT - 400),
    };
}

function isValidNum(v) { return typeof v === 'number' && isFinite(v); }

// Liang-Barsky segment vs AABB, with the AABB expanded by BULLET_RADIUS.
// Returns true if the bullet path oldPos→newPos intersects the block.
function bulletPathHitsBlock(oldX, oldY, newX, newY, block) {
    const r      = BULLET_RADIUS;
    const left   = block.x - r,        right  = block.x + block.w + r;
    const top    = block.y - r,        bottom = block.y + block.h + r;
    const dx     = newX - oldX,        dy     = newY - oldY;
    const p      = [-dx,  dx,  -dy,  dy];
    const q      = [oldX - left, right - oldX, oldY - top, bottom - oldY];
    let tmin = 0, tmax = 1;

    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
            if (q[i] < 0) return false;
        } else {
            const t = q[i] / p[i];
            if (p[i] < 0) { if (t > tmin) tmin = t; }
            else           { if (t < tmax) tmax = t; }
            if (tmin > tmax) return false;
        }
    }
    return true;
}

function removeBullet(id) {
    delete bullets[id];
    io.emit('bulletRemoved', { id });
}

function removeBulletsOwnedBy(ownerId) {
    for (const [id, b] of Object.entries(bullets)) {
        if (b.ownerId === ownerId) removeBullet(id);
    }
}

// ─── Connections ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log('player connected:', socket.id);

    const spawn = randomSpawn();
    players[socket.id] = { x: spawn.x, y: spawn.y, angle: 0, health: 100, lastBulletTime: 0 };

    socket.on('ready', () => {
        // Send map config first so the client can build the world before spawning players
        socket.emit('gameConfig', GAME_CONFIG);
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('playerJoined', { id: socket.id, ...players[socket.id] });
    });

    socket.on('playerMove', (data) => {
        const p = players[socket.id];
        if (!p || p.health <= 0) return;
        if (!data || !isValidNum(data.x) || !isValidNum(data.y) || !isValidNum(data.angle)) return;

        // Clamp to world bounds so a cheating client can't escape the arena
        p.x     = Math.max(0, Math.min(WORLD_WIDTH,  data.x));
        p.y     = Math.max(0, Math.min(WORLD_HEIGHT, data.y));
        p.angle = data.angle;

        socket.broadcast.emit('playerMoved', { id: socket.id, x: p.x, y: p.y, angle: p.angle });
    });

    socket.on('bulletFired', (data) => {
        const p = players[socket.id];
        if (!p || p.health <= 0) return;
        if (!data?.id || bullets[data.id]) return;
        if (!isValidNum(data.angle)) return;

        const now = Date.now();
        if (now - p.lastBulletTime < BULLET_RATE_MS) return;    // rate limit
        if (Object.keys(bullets).length >= MAX_BULLETS) return;  // global cap

        p.lastBulletTime = now;

        bullets[data.id] = {
            x: p.x, y: p.y,
            vx: Math.cos(data.angle) * BULLET_SPEED,
            vy: Math.sin(data.angle) * BULLET_SPEED,
            ownerId: socket.id,
        };

        socket.broadcast.emit('bulletFired', {
            id: data.id, x: p.x, y: p.y, angle: data.angle, ownerId: socket.id,
        });
    });

    socket.on('disconnect', () => {
        console.log('player disconnected:', socket.id);
        delete players[socket.id];
        removeBulletsOwnedBy(socket.id);  // don't leave orphaned bullets in flight
        io.emit('playerLeft', socket.id);
    });
});

// ─── Game tick ───────────────────────────────────────────────────────────────
let lastTick = Date.now();

setInterval(() => {
    const now = Date.now();
    const dt  = (now - lastTick) / 1000;
    lastTick  = now;

    for (const [bulletId, bullet] of Object.entries(bullets)) {
        const oldX = bullet.x, oldY = bullet.y;
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;

        // Out of bounds
        if (bullet.x < 0 || bullet.x > WORLD_WIDTH || bullet.y < 0 || bullet.y > WORLD_HEIGHT) {
            removeBullet(bulletId);
            continue;
        }

        // Server-authoritative block collision — bullet stops at walls on the server,
        // not just visually on the client
        let blocked = false;
        for (const block of BLOCK_DEFS) {
            if (bulletPathHitsBlock(oldX, oldY, bullet.x, bullet.y, block)) {
                removeBullet(bulletId);
                blocked = true;
                break;
            }
        }
        if (blocked) continue;

        // Player hit detection
        let hit = false;
        for (const [playerId, player] of Object.entries(players)) {
            if (playerId === bullet.ownerId || player.health <= 0) continue;

            const dx   = player.x - bullet.x;
            const dy   = player.y - bullet.y;
            if (Math.sqrt(dx * dx + dy * dy) > HIT_DISTANCE) continue;

            player.health = Math.max(0, player.health - BULLET_DAMAGE);
            removeBullet(bulletId);
            io.emit('playerHit', { id: playerId, health: player.health, by: bullet.ownerId });

            if (player.health <= 0) {
                // Clean up any remaining bullets the dying player had in flight
                removeBulletsOwnedBy(playerId);

                const respawn = randomSpawn();
                player.x      = respawn.x;
                player.y      = respawn.y;
                player.health = 100;

                io.emit('playerDied',      { id: playerId, by: bullet.ownerId });
                io.emit('playerRespawned', { id: playerId, x: player.x, y: player.y, health: player.health });
            }

            hit = true;
            break;
        }
        if (hit) continue;
    }
}, 1000 / TICK_RATE);

server.listen(3000, () => console.log('server running on http://localhost:3000'));