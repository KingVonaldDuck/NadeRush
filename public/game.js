// game.js
console.log("game.js is running!"); // Confirm script loads

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const worldSize = 3000;

// Our local player object
const player = {
    id: null, // This will be set by the server when connected
    x: 0,     // Initialized by server data upon connection
    y: 0,
    size: 20,
    speed: 4,
    dx: 0,
    dy: 0,
    color: "white", // Our player's fixed color
};

const camera = {
    x: 0,
    y: 0
};












// Store all other players received from the server
const remotePlayers = {}; // Dictionary to hold other players by their ID

// --- Socket.IO Client Connection ---
const socket = io(); // Connects to the server where this HTML is served from

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    player.id = socket.id; // Set our player's ID based on the socket ID
});

socket.on('serverFull', (data) => {
    alert(data.message);
    socket.disconnect(); // Disconnect if server is full
});

socket.on('currentPlayers', (playersData) => {
    console.log('Received currentPlayers data:', playersData); // See all initial player data
    for (let id in playersData) {
        if (id !== socket.id) {
            remotePlayers[id] = playersData[id];
            remotePlayers[id].size = player.size; // Ensure remote players have a size for drawing
            remotePlayers[id].color = getRandomColor(); // Assign different colors to distinguish other players
            console.log('Added remote player:', id, remotePlayers[id]);
        } else {
            // This is our own player data from the server. Use it to set initial position.
            player.x = playersData[id].x;
            player.y = playersData[id].y;
            console.log('Set own player initial position:', player.x, player.y);
        }
    }
});

socket.on('newPlayer', (newPlayerData) => {
    console.log('New player connected:', newPlayerData.id);
    if (newPlayerData.id !== socket.id) {
        remotePlayers[newPlayerData.id] = newPlayerData;
        remotePlayers[newPlayerData.id].size = player.size;
        remotePlayers[newPlayerData.id].color = getRandomColor();
    }
});

socket.on('playerMoved', (data) => {
    console.log('Received playerMoved:', data.id, data.x, data.y);
    if (remotePlayers[data.id]) {
        remotePlayers[data.id].x = data.x;
        remotePlayers[data.id].y = data.y;
    }
});

socket.on('playerDisconnected', (playerId) => {
    console.log('Player disconnected:', playerId);
    delete remotePlayers[playerId];
});











// Helper function to get a random color for other players
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Resize canvas to full screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Call once at the start to set initial canvas size

// --- Movement Controls ---
const keys = {};

let lastSentPlayerX = player.x;
let lastSentPlayerY = player.y;








window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    console.log("KeyDown:", e.key, "Keys currently pressed:", JSON.stringify(keys));
});

window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    console.log("KeyUp:", e.key, "Keys currently pressed:", JSON.stringify(keys));
});

// --- Camera update function ---
function updateCamera() {
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
}



















// --- Game Logic ---
function update() {
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];
    if (left && !right) {
        player.dx = -player.speed;
    } else if (right && !left) {
        player.dx = player.speed;
    } else {
        player.dx = 0;
    }

    const up = keys["w"] || keys["arrowup"];
    const down = keys["s"] || keys["arrowdown"];
    if (up && !down) {
        player.dy = -player.speed;
    } else if (down && !up) {
        player.dy = player.speed;
    } else {
        player.dy = 0;
    }

    player.x += player.dx;
    player.y += player.dy;

    player.x = Math.max(player.size, Math.min(worldSize - player.size, player.x));
    player.y = Math.max(player.size, Math.min(worldSize - player.size, player.y));

    updateCamera();

    if (player.x !== lastSentPlayerX || player.y !== lastSentPlayerY) {
        socket.emit("playerMove", { x: player.x, y: player.y });
        lastSentPlayerX = player.x;
        lastSentPlayerY = player.y;
        console.log("Emitting playerMove:", player.x, player.y);
    }
}























// --- Drawing ---
function drawPlayer(p) {
    if (!p || !p.id) {
        console.warn("Attempted to draw a player without a valid ID:", p);
        return;
    }

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(
        p.x - camera.x,
        p.y - camera.y,
        p.size,
        0,
        Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.id.substring(0, 4), p.x - camera.x, p.y - camera.y - p.size - 5);
}

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#444";
    ctx.fillRect(0 - camera.x, 0 - camera.y, worldSize, worldSize);

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






function drawPlayerCount() {
    let playerCount = Object.keys(remotePlayers).length + 1;
    ctx.fillStyle = 'white'
    ctx.font = '12px Courier New';
    ctx.fillText(`Players: ${playerCount}`, 45, 20);

}










// --- Main Loop ---
function loop() {
    update();
    clear();
    drawPlayerCount();

    if (player.id) {
        drawPlayer(player);
    }

    for (let id in remotePlayers) {
        drawPlayer(remotePlayers[id]);
    }

    requestAnimationFrame(loop);
}

loop();
