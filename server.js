// server.js
const express = require('express');
const http = require('http');
const path = require('path'); // We'll use path for absolute directory resolution
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const PORT = process.env.PORT || 3000; // Use process.env.PORT for deployment flexibility
const MAX_PLAYERS = 2;
const players = {}; // Server-side representation of all players

// Serve static files from the 'public' directory
// This line is crucial for your structure:
app.use(express.static(path.join(__dirname, 'public')));

// Handle the root URL to send your index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    if (Object.keys(players).length >= MAX_PLAYERS) {
        socket.emit("serverFull", { message: "Server full. Try later." });
        socket.disconnect();
        return;
    }

    console.log(`Player connected: ${socket.id}`);
    // Initialize player with a starting position. This is the server's authoritative position.
    players[socket.id] = {
        id: socket.id,
        x: Math.random() * 2000 + 500, // Randomize starting position within a range
        y: Math.random() * 2000 + 500
    };

    // Send the connecting player the current state of all players
    socket.emit("currentPlayers", players);
    // Broadcast to all *other* clients that a new player has joined
    socket.broadcast.emit("newPlayer", players[socket.id]);

    // Listen for player movement updates from clients
    socket.on("playerMove", (data) => {
        if (players[socket.id]) {
            // Update the server's authoritative position for this player
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;

            // Broadcast this player's new position to all *other* clients
            socket.broadcast.emit("playerMoved", { id: socket.id, x: data.x, y: data.y });
        }
    });

    // Handle player disconnections
    socket.on("disconnect", () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id]; // Remove player from server state
        io.emit("playerDisconnected", socket.id); // Notify all clients of disconnection
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
