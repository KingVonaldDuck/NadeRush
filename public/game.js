console.log("game.js is running!");

let socket;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const worldSize = 3000;

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

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);

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

    socket.on('playerDisconnected', (playerId) => {
        delete remotePlayers[playerId];
    });
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function updateCamera() {
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
}

function update() {
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];
    player.dx = left && !right ? -player.speed : right && !left ? player.speed : 0;

    const up = keys["w"] || keys["arrowup"];
    const down = keys["s"] || keys["arrowdown"];
    player.dy = up && !down ? -player.speed : down && !up ? player.speed : 0;

    player.x += player.dx;
    player.y += player.dy;

    player.x = Math.max(player.size, Math.min(worldSize - player.size, player.x));
    player.y = Math.max(player.size, Math.min(worldSize - player.size, player.y));

    updateCamera();

    if (player.x !== lastSentPlayerX || player.y !== lastSentPlayerY) {
        socket.emit("playerMove", { x: player.x, y: player.y });
        lastSentPlayerX = player.x;
        lastSentPlayerY = player.y;
    }
}

function drawPlayer(p) {
    ctx.fillStyle = (p.id === player.id) ? "white" : p.color;
    ctx.beginPath();
    ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(p.username || p.id.substring(0, 4), p.x - camera.x, p.y - camera.y - p.size - 5);
}


function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#444";
    ctx.fillRect(0 - camera.x, 0 - camera.y, worldSize, worldSize);

    const gridSize = 40;
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

function drawPlayerCount() {
    const playerCount = Object.keys(remotePlayers).length + 1;
    ctx.fillStyle = 'white';
    ctx.font = '12px Courier New';
    ctx.fillText(`Players: ${playerCount}`, 45, 20);
}

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

    requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Setup for username input screen and start button

document.getElementById("playBtn").addEventListener("click", () => {
    const usernameInput = document.getElementById("usernameInput");
    const username = usernameInput.value.trim();

    if (!username) {
        alert("Please enter a username.");
        return;
    }

    player.username = username;

    // Hide the home screen and show canvas
    document.getElementById("homeScreen").style.display = "none";
    canvas.style.display = "block";

    resizeCanvas();
    connectSocket();
    loop();
});
