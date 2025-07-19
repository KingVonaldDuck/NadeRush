// ====================
// Server Setup & Imports
// ====================
const express = require('express');
const http = require('http');
const path = require('path');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;

// ====================
// Game State
// ====================
const players = {};

// ====================
// Middleware & Routes
// ====================
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====================
// Utility Functions
// ====================
function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// ====================
// Constants for Gameplay
// ====================
const DAMAGE_RADIUS = 200;
const DAMAGE_AMOUNT = 10;

// ====================
// Socket.IO Event Handling
// ====================
io.on('connection', (socket) => {
    console.log(`Player connected (socket.id): ${socket.id}`);

    // Server capacity check
    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit("serverFull", { message: "Server full. Try later." });
        socket.disconnect();
        return;
    }

    // Player registration
    socket.on('registerPlayer', (data) => {
        const username = (data.username || "Player").trim();

        players[socket.id] = {
            id: socket.id,
            username,
            x: Math.random() * 2000 + 500,
            y: Math.random() * 2000 + 500,
            color: getRandomColor(),
            health: 100,
            alive: true
        };

        console.log(`Registered player: ${username} (${socket.id})`);

        // Send current players to new player
        const alivePlayers = {};
        for (const id in players) {
            alivePlayers[id] = players[id];
        }
        socket.emit('currentPlayers', alivePlayers);

        // Notify others about the new player
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // Player movement updates
    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: data.x,
                y: data.y,
                alive: players[socket.id].alive
            });
        }
    });

    // Bomb dropped event and explosion handling
    socket.on('dropBomb', (data) => {
        console.log('Bomb dropped by:', socket.id, data);

        // Broadcast bomb drop to all clients
        io.emit('bombDropped', {
            startX: data.startX,
            startY: data.startY,
            targetX: data.targetX,
            targetY: data.targetY,
            ownerId: data.id,
        });

        // Delay to simulate bomb travel, then apply damage
        setTimeout(() => {
            const explosionX = data.targetX;
            const explosionY = data.targetY;

            console.log(`Bomb exploded at (${explosionX}, ${explosionY})`);

            const damagedPlayers = [];

            for (const id in players) {
                const p = players[id];

                if (!p.alive || p.health <= 0) continue;

                if (dist(p.x, p.y, explosionX, explosionY) <= DAMAGE_RADIUS) {
                    p.health = Math.max(0, p.health - DAMAGE_AMOUNT);

                    if (p.health === 0) {
                        p.alive = false;

                        // Send death info to the victim
                        io.to(p.id).emit('death', socket.id);

                        // Broadcast death and health update
                        io.emit('playerHealthUpdate', {
                            id: p.id,
                            health: 0,
                            alive: false
                        });

                        // Respawn after 3 seconds
                        setTimeout(() => {
                            p.health = 100;
                            p.alive = true;
                            p.x = Math.random() * 2000 + 500;
                            p.y = Math.random() * 2000 + 500;

                            io.to(p.id).emit('respawn', {
                                x: p.x,
                                y: p.y,
                                health: p.health,
                                alive: true
                            });

                            io.emit('playerHealthUpdate', {
                                id: p.id,
                                health: p.health,
                                alive: true
                            });

                            io.emit('playerMoved', {
                                id: p.id,
                                x: p.x,
                                y: p.y,
                                alive: true
                            });

                        }, 3000);
                    } else {
                        damagedPlayers.push({ id: p.id, health: p.health, alive: p.alive });
                    }
                }
            }

            damagedPlayers.forEach(({ id, health, alive }) => {
                io.emit('playerHealthUpdate', { id, health, alive });
            });

        }, 1500);
    });

    // Player disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// ====================
// Server Start
// ====================
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
