const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};

io.on('connection', (socket) => {
    console.log('player connected:', socket.id);

    players[socket.id] = { x: 1000, y: 1000, angle: 0 };

    socket.on('ready', () => {
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('playerJoined', { id: socket.id, ...players[socket.id] });
    });

    socket.on('playerMove', (data) => {
        const p = players[socket.id];
        if (!p) return;

        p.x = data.x;
        p.y = data.y;
        p.angle = data.angle;

        socket.broadcast.emit('playerMoved', { id: socket.id, x: p.x, y: p.y, angle: p.angle });
    });

    socket.on('bulletFired', (data) => {
        socket.broadcast.emit('bulletFired', { ...data, id: socket.id });
    });

    socket.on('disconnect', () => {
        console.log('player disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

server.listen(3000, () => {
    console.log('server running on http://localhost:3000');
});