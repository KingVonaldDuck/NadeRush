console.log("game.js is running!");

// ---------------------
// Constants & Globals
// ---------------------

let socket;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const worldSize = 3000;

const bombs = [];
const explosions = [];

const player = {
    id: null,
    username: null,
    x: 0,
    y: 0,
    size: 20,
    speed: 4,
    dx: 0,
    dy: 0,
    color: "white",
};

const remotePlayers = {};
const camera = { x: 0, y: 0 };
const keys = {};
let lastSentPlayerX = 0;
let lastSentPlayerY = 0;

const grenadeImg = new Image();
grenadeImg.src = 'grenade-grey.png';

// ---------------------
// Utility Functions
// ---------------------

// Easing function for ease-out cubic interpolation
function easeOutQuad(t) {
    return 1 - Math.pow(1 - t, 3);
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// ---------------------
// Canvas Setup & Resize
// ---------------------

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);

// ---------------------
// Socket.IO Connection & Event Handlers
// ---------------------

function connectSocket() {
    socket = io();

    console.log("Socket initialized");

    socket.on('connect', () => {
        player.id = socket.id;
        console.log('Connected to server with ID:', socket.id);
        socket.emit("registerPlayer", { username: player.username });
    });

    socket.on('serverFull', (data) => {
        alert(data.message);
        socket.disconnect();
    });

    socket.on('currentPlayers', (playersData) => {
        console.log('Received currentPlayers:', playersData);
        for (let id in playersData) {
            if (id !== socket.id) {
                remotePlayers[id] = playersData[id];
                remotePlayers[id].size = player.size;
                remotePlayers[id].color = playersData[id].color || getRandomColor();
            } else {
                player.x = playersData[id].x;
                player.y = playersData[id].y;
                player.color = playersData[id].color || player.color;
            }
        }
    });

    socket.on('newPlayer', (newPlayerData) => {
        console.log('New player joined:', newPlayerData);
        if (newPlayerData.id !== socket.id) {
            remotePlayers[newPlayerData.id] = newPlayerData;
            remotePlayers[newPlayerData.id].size = player.size;
            remotePlayers[newPlayerData.id].color = newPlayerData.color || getRandomColor();
        }
    });

    socket.on('playerMoved', (data) => {
        if (remotePlayers[data.id]) {
            remotePlayers[data.id].x = data.x;
            remotePlayers[data.id].y = data.y;
        }
    });

    socket.on("bombDropped", (bombData) => {
        console.log('Received bombDropped:', bombData);
        bombs.push({
            startX: bombData.startX,
            startY: bombData.startY,
            targetX: bombData.targetX,
            targetY: bombData.targetY,
            x: bombData.startX,
            y: bombData.startY,
            progress: 0,
            exploded: false,
            radius: 10,
            ownerId: bombData.ownerId || null,
            rotationAngle: 0,
            timeSinceThrow: 0,
        });
    });

    socket.on('playerDisconnected', (playerId) => {
        delete remotePlayers[playerId];
    });
}

// ---------------------
// Game State Update Functions
// ---------------------

function updateCamera() {
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
}

function update() {
    // Player movement input
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];
    player.dx = left && !right ? -player.speed : right && !left ? player.speed : 0;

    const up = keys["w"] || keys["arrowup"];
    const down = keys["s"] || keys["arrowdown"];
    player.dy = up && !down ? -player.speed : down && !up ? player.speed : 0;

    // Update player position
    player.x += player.dx;
    player.y += player.dy;

    // Clamp player position within world boundaries
    player.x = Math.max(player.size, Math.min(worldSize - player.size, player.x));
    player.y = Math.max(player.size, Math.min(worldSize - player.size, player.y));

    updateCamera();

    // Emit player movement only if position changed
    if (player.x !== lastSentPlayerX || player.y !== lastSentPlayerY) {
        socket.emit("playerMove", { x: player.x, y: player.y });
        lastSentPlayerX = player.x;
        lastSentPlayerY = player.y;
    }

    // Update bombs
    for (let i = bombs.length - 1; i >= 0; i--) {
        const bomb = bombs[i];

        bomb.timeSinceThrow += 1 / 60; // assuming 60 FPS approx

        if (!bomb.exploded) {
            bomb.progress += 0.007;  // progress towards target
            let t = Math.min(bomb.progress, 1);
            let easedT = easeOutQuad(t);

            bomb.x = bomb.startX + (bomb.targetX - bomb.startX) * easedT;
            bomb.y = bomb.startY + (bomb.targetY - bomb.startY) * easedT;

            // Spin while moving
            bomb.rotationAngle += 0.1;

            // Explosion/removal condition
            if (bomb.progress >= 0.8 || bomb.timeSinceThrow >= 1.5) {
                explosions.push({
                    x: bomb.x,
                    y: bomb.y,
                    radius: 0,
                    maxRadius: 300,
                    opacity: 1,
                    expandSpeed: 20,
                    fadeSpeed: 0.06,
                });

                bombs.splice(i, 1);
                console.log("boom");
            }
        }
    }

    updateExplosions();
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        exp.radius += exp.expandSpeed;
        exp.opacity -= exp.fadeSpeed;

        if (exp.radius >= exp.maxRadius) {
            explosions.splice(i, 1);
        }
    }
}

// ---------------------
// Drawing Functions
// ---------------------

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#444";
    ctx.fillRect(0 - camera.x, 0 - camera.y, worldSize, worldSize);

    // Grid
    const gridSize = 50;
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;

    for (let x = (-camera.x % gridSize); x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = (-camera.y % gridSize); y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawPlayer(p) {
    ctx.fillStyle = (p.id === player.id) ? "white" : p.color;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = '16px Consolas';
    ctx.textAlign = 'center';
    ctx.fillText(p.username || p.id.substring(0, 4), p.x - camera.x, p.y - camera.y - p.size - 15);
}

function drawBombs() {
    for (const bomb of bombs) {
        const x = bomb.x - camera.x;
        const y = bomb.y - camera.y;
        const size = bomb.radius * 2;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(bomb.rotationAngle);
        ctx.drawImage(grenadeImg, -bomb.radius, -bomb.radius, size, size);
        ctx.restore();
    }
}

function drawExplosions() {
    for (const exp of explosions) {
        ctx.save();
        ctx.globalAlpha = exp.opacity;
        ctx.fillStyle = "orange";
        ctx.beginPath();
        ctx.arc(exp.x - camera.x, exp.y - camera.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawPlayerCount() {
    const playerCount = Object.keys(remotePlayers).length + 1;
    ctx.fillStyle = 'white';
    ctx.font = '16px Consolas';
    ctx.fillText(`Players: ${playerCount}`, 55, 20);
}

// ---------------------
// Main Loop
// ---------------------

function loop() {
    update();
    clear();
    drawPlayerCount();

    if (player.id) {
        drawPlayer(player);
    }

    for (const id in remotePlayers) {
        drawPlayer(remotePlayers[id]);
    }

    drawBombs();
    drawExplosions();

    requestAnimationFrame(loop);
}

// ---------------------
// Input Handlers & Game Start
// ---------------------

document.getElementById("playBtn").addEventListener("click", () => {
    const usernameInput = document.getElementById("usernameInput");
    let username = usernameInput.value.trim();

    if (!username) {
        username = "Player";
    }

    player.username = username;

    // Hide the home screen and show the game canvas.
    document.getElementById("homeScreen").style.display = "none";
    canvas.style.display = "block";

    resizeCanvas();
    connectSocket();
    loop();

    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left + camera.x;
            const mouseY = e.clientY - rect.top + camera.y;

            socket.emit('dropBomb', {
                startX: player.x,
                startY: player.y,
                targetX: mouseX,
                targetY: mouseY,
                id: socket.id
            });
        }
    });

    window.addEventListener("keydown", (e) => {
        keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener("keyup", (e) => {
        keys[e.key.toLowerCase()] = false;
    });
});
