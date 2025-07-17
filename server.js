const express = require('express');
const http = require('http');
const path = require('path');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;

const players = {};
const bombs = [];

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log(`Player connected (socket.id): ${socket.id}`);

    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit("serverFull", { message: "Server full. Try later." });
        socket.disconnect();
        return;
    }

    socket.on('registerPlayer', (data) => {
        const username = (data.username || "Player").trim();

        players[socket.id] = {
            id: socket.id,
            username,
            x: Math.random() * 2000 + 500,
            y: Math.random() * 2000 + 500,
            color: getRandomColor(),
            health: 100 // Everyone starts with 100 health
        };

        console.log(`Registered player: ${username} (${socket.id})`);

        // Send all current players (including health) to the new player
        socket.emit('currentPlayers', players);

        // Broadcast new player (including health) to others
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

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

    socket.on('dropBomb', (data) => {
        console.log('Bomb dropped by:', socket.id, data);
        const bomb = {
            startX: data.startX,
            startY: data.startY,
            targetX: data.targetX,
            targetY: data.targetY,
            ownerId: data.id,
        };
        io.emit('bombDropped', bomb);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i=0; i<6; i++) {
        color += letters[Math.floor(Math.random()*16)];
    }
    return color;
}

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
