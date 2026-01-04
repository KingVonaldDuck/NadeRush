const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const world = { width: 1000, height: 1000 };
const playerRadius = 20;
const playerSpeed = 125;

const waitingQueue = [];
const games = {}; // roomId -> { players: [] }

io.on('connection', socket => {

    socket.on('join_game', () => {
        if (waitingQueue.length > 0) {
            const opponent = waitingQueue.pop();
            const roomId = `room_${socket.id}_${opponent.id}`;

            socket.join(roomId);
            opponent.join(roomId);

            games[roomId] = {
                players: [
                    createPlayer(opponent.id),
                    createPlayer(socket.id)
                ]
            };

            opponent.roomId = roomId;
            socket.roomId = roomId;

            opponent.emit('game_start', { roomId, index: 0 });
            socket.emit('game_start', { roomId, index: 1 });

        } else {
            waitingQueue.push(socket);
            socket.emit('waiting');
        }
    });

    socket.on('inputs', inp => {
        const roomId = socket.roomId;
        if (!roomId || !games[roomId]) return;

        const game = games[roomId];
        const p = game.players.find(pl => pl.id === socket.id);
        if (!p) return;

        p.angle = inp.angle;

        const dt = 1 / 60;
        if (inp.w && !inp.s) p.y -= p.speed * dt;
        if (inp.s && !inp.w) p.y += p.speed * dt;
        if (inp.a && !inp.d) p.x -= p.speed * dt;
        if (inp.d && !inp.a) p.x += p.speed * dt;

        p.x = Math.max(playerRadius, Math.min(world.width - playerRadius, p.x));
        p.y = Math.max(playerRadius, Math.min(world.height - playerRadius, p.y));
        p.emote = inp.emote;
        p.weapon = inp.weapon;
    });

    socket.on('disconnect', () => {
        const i = waitingQueue.indexOf(socket);
        if (i !== -1) waitingQueue.splice(i, 1);

        const roomId = socket.roomId;
        if (!roomId || !games[roomId]) return;

        // Notify opponent
        socket.to(roomId).emit('opponent_left');

        // Clean up game
    delete games[roomId];
    });



});

// --- GAME LOOP ---
setInterval(() => {
    for (const roomId in games) {
        io.to(roomId).emit('state', games[roomId].players);
    }
}, 1000 / 120);

function createPlayer(id) {
    return {
        id,
        x: world.width / 2,
        y: world.height / 2,
        radius: playerRadius,
        speed: playerSpeed,
        angle: 0
    };
}

http.listen(3000, () => console.log('Server running on port 3000'));
