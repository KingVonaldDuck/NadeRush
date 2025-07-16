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

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html on root
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

    // Wait for the client to register username before adding player
    socket.on('registerPlayer', (data) => {
        const username = (data.username || "Player").trim();

        // Initialize player data and add to players list
        players[socket.id] = {
            id: socket.id,
            username,
            x: Math.random() * 2000 + 500,
            y: Math.random() * 2000 + 500,
            color: getRandomColor(),
        };

        console.log(`Registered player: ${username} (${socket.id})`);
        // Send full players list to new player
        socket.emit('currentPlayers', players);

        // Notify all others about new player
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });

    // Update player position and broadcast
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
