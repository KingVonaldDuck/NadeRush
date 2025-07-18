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
            health: 100
        };

        console.log(`Registered player: ${username} (${socket.id})`);

        // Send current players to new player
        socket.emit('currentPlayers', players);

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

            // Track damaged players to broadcast updates efficiently
            const damagedPlayers = [];

            for (const id in players) {
                const p = players[id];
                if (dist(p.x, p.y, explosionX, explosionY) <= DAMAGE_RADIUS) {
                    p.health = Math.max(0, p.health - DAMAGE_AMOUNT);
                    damagedPlayers.push({ id: p.id, health: p.health });
                    console.log(`Damaged player ${p.username} (${p.id}). New health: ${p.health}`);

                    // Optional: Kick player if health reaches zero
                    if (p.health === 0) {
                        io.to(p.id).emit('kicked', { reason: 'You died!' });
                        delete players[p.id];
                        io.emit('playerDisconnected', p.id);
                    }
                }
            }

            // Broadcast health updates to all clients
            damagedPlayers.forEach(({ id, health }) => {
                io.emit('playerHealthUpdate', { id, health });
            });

        }, 1500); // Delay matches client-side explosion timing
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
