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

const hotbarItems = ['🧨', '💣', '🔫', '🛡️', '⚡', '🪖'];
let selectedItemIndex = 0;

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
    health: 100,
    alive: true
};

const remotePlayers = {};
const camera = { x: 0, y: 0 };
const keys = {};
let lastSentPlayerX = 0;
let lastSentPlayerY = 0;

let spectating = false;
let spectateTarget = null;

let mouseX = 0;
let mouseY = 0;



const grenadeImg = new Image();
grenadeImg.src = 'grenade-grey.png';

// ---------------------
// Utility Functions
// ---------------------

// Easing function for ease-out cubic interpolation
function easeOutQuad(t) {
    return 1 - Math.pow(1 - t, 3);
}

function dist(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function playSoundAtVolume(soundPath, sourceX, sourceY, maxDistance = 1000) {
    const distance = dist(player.x, player.y, sourceX, sourceY);
    const volume = Math.max(0, 1 - distance / maxDistance);

    const sound = new Audio(soundPath);
    sound.volume = volume;
    sound.play();
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

    socket.on('death', (killerId) => {
        player.alive = false;
        player.killerId = killerId;

        if (killerId === player.id) {
            player.killerName = "Yourself";
        } else if (remotePlayers[killerId]) {
            player.killerName = remotePlayers[killerId].username || killerId;
        } else {
            player.killerName = killerId;
        }

        console.log(`You were killed by ${player.killerName}`);

        // Delay spectate by 1 second
        setTimeout(() => {
            spectating = true;
            spectateTarget = killerId;
        }, 1000);
    });

    socket.on('respawn', (data) => {
        player.x = data.x;
        player.y = data.y;
        player.health = data.health;
        player.alive = true;

        spectating = false;
        spectateTarget = null;

        console.log("You have respawned!");
    });

    socket.on('currentPlayers', (playersData) => {
        console.log('Received currentPlayers:', playersData);
        for (let id in playersData) {
            if (id !== socket.id) {
                remotePlayers[id] = playersData[id];
                remotePlayers[id].size = player.size;
                remotePlayers[id].color = playersData[id].color || getRandomColor();
                remotePlayers[id].alive = playersData[id].alive;
            } else {
                player.x = playersData[id].x;
                player.y = playersData[id].y;
                player.color = playersData[id].color || player.color;
                player.health = playersData[id].health || player.health;
                player.alive = playersData[id].alive;
            }
        }
    });

    socket.on('newPlayer', (newPlayerData) => {
        console.log('New player joined:', newPlayerData);
        if (newPlayerData.id !== socket.id) {
            remotePlayers[newPlayerData.id] = newPlayerData;
            remotePlayers[newPlayerData.id].size = player.size;
            remotePlayers[newPlayerData.id].color = newPlayerData.color || getRandomColor();
            remotePlayers[newPlayerData.id].alive = newPlayerData.alive !== undefined ? newPlayerData.alive : true;
        }
    });

    socket.on('playerMoved', (data) => {
        if (remotePlayers[data.id]) {
            remotePlayers[data.id].x = data.x;
            remotePlayers[data.id].y = data.y;
            remotePlayers[data.id].alive = data.alive; // <-- update alive here
        }
    });

    socket.on("playerRotation", (data) => {
        if (remotePlayers[data.id]) {
            remotePlayers[data.id].rotation = data.rotation;
        }
    });


    socket.on("bombDropped", (bombData) => {
        console.log('Received bombDropped:', bombData);

        const { startX, startY, targetX, targetY } = bombData;

        const timeToReach = 1.5; // seconds
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);

        const speed = ((distToTarget / timeToReach) * 2 > 1000) ? 1000 : (distToTarget / timeToReach) * 2;
        const angle = Math.atan2(dy, dx);

        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        bombs.push({
            x: startX,
            y: startY,
            vx,
            vy,
            rotationAngle: 0,
            timeSinceThrow: 0,
            explodeAfter: timeToReach,
            exploded: false,
            radius: 10
        });

        playSoundAtVolume("Nade-Throw.mp3", startX, startY, 800);
    });


    socket.on('playerHealthUpdate', ({ id, health, alive }) => {
        if (id === player.id) {
            player.health = health;
            player.alive = alive;
        } else if (remotePlayers[id]) {
            remotePlayers[id].health = health;
            remotePlayers[id].alive = alive;  // correct this line
        }
    });

    socket.on('playerDisconnected', (playerId) => {
        delete remotePlayers[playerId];
    });
}

// ---------------------
// Game State Update Functions
// ---------------------


function updateCamera(target) {
    if (!target) return;
    camera.x = target.x - canvas.width / 2;
    camera.y = target.y - canvas.height / 2;
}

function updateBombsAndExplosions(dt) {
    const bounceDamping = 1;
    const bombRadius = 10;    // tweak if needed
    const playerRadius = 20;  // tweak if needed
    const bounceGracePeriod = 0.1; // seconds

    for (let i = bombs.length - 1; i >= 0; i--) {
        const bomb = bombs[i];
        bomb.timeSinceThrow += dt;

        if (!bomb.exploded) {
            bomb.x += bomb.vx * dt;
            bomb.y += bomb.vy * dt;

            if (bomb.x < 0) {
                bomb.x = 0;
                bomb.vx = -bomb.vx * bounceDamping;
            } else if (bomb.x > worldSize) {
                bomb.x = worldSize;
                bomb.vx = -bomb.vx * bounceDamping;
            }

            if (bomb.y < 0) {
                bomb.y = 0;
                bomb.vy = -bomb.vy * bounceDamping;
            } else if (bomb.y > worldSize) {
                bomb.y = worldSize;
                bomb.vy = -bomb.vy * bounceDamping;
            }

            // --- NEW: Bounce off players with grace period ---
            for (const id in remotePlayers) {
                if (bomb.timeSinceThrow < bounceGracePeriod) continue;

                const player = remotePlayers[id];
                const dx = bomb.x - player.x;
                const dy = bomb.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = bombRadius + playerRadius;

                if (dist < minDist) {
                    const nx = dx / dist;
                    const ny = dy / dist;

                    const dot = bomb.vx * nx + bomb.vy * ny;
                    bomb.vx = bomb.vx - 2 * dot * nx;
                    bomb.vy = bomb.vy - 2 * dot * ny;

                    bomb.vx *= bounceDamping;
                    bomb.vy *= bounceDamping;

                    const overlap = minDist - dist;
                    bomb.x += nx * overlap;
                    bomb.y += ny * overlap;
                }
            }
            // --- END NEW ---

            bomb.vx *= 0.98;
            bomb.vy *= 0.98;

            bomb.rotationAngle += 0.1 * 60 * dt;

            if (bomb.timeSinceThrow >= bomb.explodeAfter) {
                socket.emit('bombExploded', {
                    explosionX: bomb.x,
                    explosionY: bomb.y,
                    ownerId: player.id
                });
                console.log("boom");

                explosions.push({
                    x: bomb.x,
                    y: bomb.y,
                    radius: 0,
                    maxRadius: 200,
                    opacity: 1,
                    expandSpeed: 1000,
                    fadeSpeed: 4,
                });
                playSoundAtVolume("Nade-Boom.mp3", bomb.x, bomb.y, 1000);
                bombs.splice(i, 1);
                console.log("💥 boom");
            }
        }
    }

    updateExplosions(dt);
}

function updateExplosions(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        exp.radius += exp.expandSpeed * dt;
        exp.opacity -= exp.fadeSpeed * dt;

        if (exp.radius >= exp.maxRadius) {
            explosions.splice(i, 1);
        }
    }
}

let lastTimestamp = 0;

function update(dt) {
    // If player is dead, skip player movement and emitting movement
    if (!player.alive) {
        player.dx = 0;
        player.dy = 0;

        // Still update bombs and explosions so game effects keep running
        updateBombsAndExplosions(dt);

        // Also update camera to spectate if applicable
        if (spectating && remotePlayers[spectateTarget]) {
            updateCamera(remotePlayers[spectateTarget]);
        } else {
            updateCamera(player);
        }

        return; // skip rest
    }

    // Player movement input
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];
    player.dx = left && !right ? -player.speed : right && !left ? player.speed : 0;

    const up = keys["w"] || keys["arrowup"];
    const down = keys["s"] || keys["arrowdown"];
    player.dy = up && !down ? -player.speed : down && !up ? player.speed : 0;

    // Update player position (using dt)
    player.x += player.dx * dt * 60; // multiply by 60 for natural speed (since speed is tuned for ~60fps)
    player.y += player.dy * dt * 60;

    // Clamp player position within world boundaries
    player.x = Math.max(player.size, Math.min(worldSize - player.size, player.x));
    player.y = Math.max(player.size, Math.min(worldSize - player.size, player.y));

    // Update camera (normal or spectate)
    if (spectating && remotePlayers[spectateTarget]) {
        updateCamera(remotePlayers[spectateTarget]);
    } else {
        updateCamera(player);
    }

    // Emit player movement only if position changed
    if (player.x !== lastSentPlayerX || player.y !== lastSentPlayerY) {
        socket.emit("playerMove", { x: player.x, y: player.y });
        lastSentPlayerX = player.x;
        lastSentPlayerY = player.y;
    }

    // Emit mouse rotation movement to display where players point
    // Calculate rotation toward mouse world coords
    const mouseWorldX = mouseX + camera.x;
    const mouseWorldY = mouseY + camera.y;
    const dx = mouseWorldX - player.x;
    const dy = mouseWorldY - player.y;
    const rotation = Math.atan2(dy, dx);

    // Always emit rotation
    socket.emit("playerRotation", { rotation });

    // Update bombs and explosions
    updateBombsAndExplosions(dt);
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
    const camX = camera.x;
    const camY = camera.y;

    const px = p.x - camX;
    const py = p.y - camY;

    const size = p.size;

    // Determine rotation:
    // - If it's the local player, calculate live rotation toward mouse
    // - Else, use .rotation as sent by the server
    let rotation = p.rotation || 0;
    if (p.id === player.id) {
        const mouseWorldX = mouseX + camera.x;
        const mouseWorldY = mouseY + camera.y;
        const dx = mouseWorldX - p.x;
        const dy = mouseWorldY - p.y;
        rotation = Math.atan2(dy, dx);
    } else {
        rotation = p.rotation;
    }

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rotation);

    

    // Draw hands (front-left and front-right)
    const handDistanceForward = size * 0.6;
    const handSideOffset = size * 0.52;
    const handRadius = size * 0.425;

    const leftX = Math.cos(0) * handDistanceForward - Math.sin(0) * handSideOffset;
    const leftY = Math.sin(0) * handDistanceForward + Math.cos(0) * handSideOffset;

    const rightX = Math.cos(0) * handDistanceForward + Math.sin(0) * handSideOffset;
    const rightY = Math.sin(0) * handDistanceForward - Math.cos(0) * handSideOffset;

    ctx.fillStyle = '#cececeff';
    ctx.beginPath();
    ctx.arc(leftX, leftY, handRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rightX, rightY, handRadius, 0, Math.PI * 2);
    ctx.fill();


    // Draw body (circle)
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();



    ctx.restore();

    // Draw name above
    ctx.fillStyle = 'white';
    ctx.font = '16px Consolas';
    ctx.textAlign = 'center';
    ctx.fillText(p.username || p.id.substring(0, 4), px, py - size - 20);
}




let pulseTime = 0;

function drawBombs() {
    pulseTime += 0.15;
    const pulseScale = 1 + Math.sin(pulseTime) * 0.1;
    for (const bomb of bombs) {
        const x = bomb.x - camera.x;
        const y = bomb.y - camera.y;
        const size = bomb.radius * 2;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(bomb.rotationAngle);
        ctx.scale(pulseScale, pulseScale);
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

function drawHealthBar(health) {
    const barWidth = 300;
    const barHeight = 30;
    const x = 40;
    const y = canvas.height - 70;

    const healthRatio = Math.max(0, health) / 100;

    // Background
    ctx.fillStyle = '#1f1f1fff';
    ctx.fillRect(x, y, barWidth, barHeight);

    // Health
    ctx.fillStyle = '#439b4aff';
    ctx.fillRect(x, y, barWidth * healthRatio, barHeight);

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);

    ctx.fillStyle = 'white';
    ctx.font = '16px Consolas';
    ctx.fillText(health, 55, canvas.height - 80);
}



function drawHotbar(ctx, canvas) {
  const slotSize = 50;
  const spacing = 10;
  const padding = 20;

  const totalWidth = hotbarItems.length * (slotSize + spacing) - spacing;
  const startX = canvas.width - totalWidth - padding;
  const y = canvas.height - slotSize - padding;

  for (let i = 0; i < hotbarItems.length; i++) {
    const x = startX + i * (slotSize + spacing);

    // Background
    ctx.fillStyle = i === selectedItemIndex ? '#afafafff' : 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, slotSize, slotSize);

    // Border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, slotSize, slotSize);

    // Item icon
    ctx.fillStyle = 'white';
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hotbarItems[i], x + slotSize / 2, y + slotSize / 2);
  }
}





function drawSpectateInfo() {
    if (!player.alive && player.killerName) {
        ctx.fillStyle = 'red';
        ctx.font = '28px Consolas';
        ctx.textAlign = 'center';

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 3;

        ctx.fillText(`ELIMINATED BY ${player.killerName}`, centerX, centerY - 20);
        ctx.fillStyle = 'white';
        ctx.font = '22px Consolas';
        ctx.fillText(`SPECTATING ${player.killerName}`, centerX, centerY + 20);
    }
}




// ---------------------
// Main Loop
// ---------------------

// Updated main loop to handle dt
function loop(timestamp = 0) {
    const dt = (timestamp - lastTimestamp) / 1000; // convert ms to seconds
    lastTimestamp = timestamp;

    update(dt);

    clear();

    



    drawBombs();
    drawExplosions();
    
    if (player.id && player.alive) {
        drawPlayer(player);
    }

    for (const id in remotePlayers) {
        if (remotePlayers[id].alive) {
            drawPlayer(remotePlayers[id]);
        }
    }

    drawHealthBar(player.health);

    drawHotbar(ctx, canvas);

    if (!player.alive) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    drawSpectateInfo();
    drawPlayerCount();

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

        if (hotbarItems[selectedItemIndex] === '💣') {

            if (e.button === 0 && player.alive) { // only if alive
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

        }

    });


    window.addEventListener("keydown", (e) => {
        keys[e.key.toLowerCase()] = true;
    });

    window.addEventListener("keyup", (e) => {
        keys[e.key.toLowerCase()] = false;
    });


    window.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (!isNaN(num) && num >= 1 && num <= hotbarItems.length) {
        selectedItemIndex = num - 1;
    }
    });

    window.addEventListener('mousemove', function(event) {
        mouseX = event.clientX;
        mouseY = event.clientY;

    });




});
