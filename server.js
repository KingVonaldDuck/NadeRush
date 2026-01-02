const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public')); // serve index.html and game.js

const world = { width: 1000, height: 1000 };
const playerRadius = 20;
const playerSpeed = 250; // pixels/sec
const players = [null, null]; // 2 slots for 1v1

io.on('connection', socket => {
    console.log('A user connected');

    // Assign player slot
    let index = players[0] ? 1 : 0;
    if(players[index]) {
        socket.emit('full'); // game full
        socket.disconnect();
        return;
    }

    // Initialize player
    players[index] = {
        id: socket.id,
        x: world.width/2,
        y: world.height/2,
        radius: playerRadius,
        speed: playerSpeed,
        angle: 0
    };

    socket.emit('playerData', { index });

    // Receive inputs
    socket.on('inputs', inp => {
        const p = players[index];
        if(!p) return;

        // Update rotation
        p.angle = inp.angle;

        // Update movement
        const dt = 1/60; // approximate frame time
        if(inp.w && !inp.s) p.y -= p.speed * dt;
        if(inp.s && !inp.w) p.y += p.speed * dt;
        if(inp.a && !inp.d) p.x -= p.speed * dt;
        if(inp.d && !inp.a) p.x += p.speed * dt;

        // Clamp to world
        p.x = Math.max(playerRadius, Math.min(world.width - playerRadius, p.x));
        p.y = Math.max(playerRadius, Math.min(world.height - playerRadius, p.y));
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        players[index] = null;
    });
});

// Broadcast state 60 times/sec
setInterval(() => {
    io.emit('state', players);
}, 1000/60);

http.listen(3000, () => console.log('Server running on port 3000'));
