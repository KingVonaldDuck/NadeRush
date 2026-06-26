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

    socket.on('playerInput', (input) => {
        const p = players[socket.id];
        if (!p) return;

        const speed = 4;
        if (input.left)  p.x -= speed;
        if (input.right) p.x += speed;
        if (input.up)    p.y -= speed;
        if (input.down)  p.y += speed;

        p.angle = input.angle;

        socket.broadcast.emit('playerMoved', { id: socket.id, x: p.x, y: p.y, angle: p.angle });
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