console.log("game.js is running!");

// ---------------------
// Constants & Globals
// ---------------------

let socket;

let canAct = true;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const worldSize = 3000;

const hotbarItems = ['🤜', '🔫', '🚀', '💥', '💣', '🛡️'];

const bullets = [];

let selectedItemIndex = 0;

//import weapons from './weapons.js';



const player = {
    id: null,
    username: null,
    x: 0,
    y: 0,
    size: 20,
    speed: 4,
    dx: 0,
    dy: 0,
    color: "white"
};

const remotePlayers = {};
const camera = { x: 0, y: 0 };
const keys = {};
let lastSentPlayerX = 0;
let lastSentPlayerY = 0;

let mouseX = 0;
let mouseY = 0;

// ---------------------
// Utility Functions--------------------------------------------------------------------------------------------------------------------------------
// ---------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------

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
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);

// ---------------------
// Socket.IO Connection & Event Handlers
// ---------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------

function connectSocket() {
    socket = io();

    console.log("Socket initialized");

    socket.on('connect', () => {
        player.id = socket.id;
        console.log('Connected to server with ID:', socket.id);
        socket.emit("registerPlayer", { username: player.username });

        setInterval(sendPlayerInput, 50);
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

    socket.on("playerRotation", (data) => {
        if (remotePlayers[data.id]) {
            remotePlayers[data.id].rotation = data.rotation;
        }
    });

    socket.on("stateUpdate", (playersData) => {
        for (const id in playersData) {
            const data = playersData[id];

            if (id === player.id) {
                // Update local player position & rotation
                player.x = data.x;
                player.y = data.y;
                player.rotation = data.rotation;
                player.color = data.color || player.color;
                player.size = data.size || player.size;
            } else {
                // Update remote players
                if (!remotePlayers[id]) {
                    remotePlayers[id] = {
                        id,
                        username: data.username || id,
                        size: data.size || 20,
                        color: data.color || getRandomColor(),
                        rotation: data.rotation || 0,
                        x: data.x,
                        y: data.y
                    };
                } else {
                    remotePlayers[id].x = data.x;
                    remotePlayers[id].y = data.y;
                    remotePlayers[id].rotation = data.rotation;
                }
            }
        }
    });



    socket.on("bulletsUpdate", (serverBullets) => {
        bullets.length = 0; // clear existing array
        for (const b of serverBullets) {
            bullets.push(b);
        }
    });

}

// ---------------------
// Game State Update Functions
// ---------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------

function updateCamera(target) {
    if (!target) return;
    camera.x = target.x - canvas.width / 2;
    camera.y = target.y - canvas.height / 2;
}

function sendPlayerInput() {
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];
    const up = keys["w"] || keys["arrowup"];
    const down = keys["s"] || keys["arrowdown"];

    const dx = left && !right ? -1 : right && !left ? 1 : 0;
    const dy = up && !down ? -1 : down && !up ? 1 : 0;

    socket.emit('playerInput', { dx, dy });
}

let lastTimestamp = 0;

function update(dt) {
    const left = keys["a"] || keys["arrowleft"];
    const right = keys["d"] || keys["arrowright"];
    const up = keys["w"] || keys["arrowup"];
    const down = keys["s"] || keys["arrowdown"];

    const dx = left && !right ? -1 : right && !left ? 1 : 0;
    const dy = up && !down ? -1 : down && !up ? 1 : 0;

    //player.x += dx * player.speed;
    //player.y += dy * player.speed;

    updateCamera(player);

    if (player.x !== lastSentPlayerX || player.y !== lastSentPlayerY) {
        socket.emit("playerInput", { dx, dy });
        lastSentPlayerX = player.x;
        lastSentPlayerY = player.y;
    }

    const mouseWorldX = mouseX + camera.x;
    const mouseWorldY = mouseY + camera.y;
    const deltaX = mouseWorldX - player.x;
    const deltaY = mouseWorldY - player.y;
    const rotation = Math.atan2(deltaY, deltaX);

    socket.emit("playerRotation", { rotation });

}





function drawBullets() {
  for (const b of bullets) {
    const bulletLength = 15;
    const bulletWidth = 3;

    ctx.save();
    ctx.translate(b.x - camera.x, b.y - camera.y);
    ctx.rotate(b.rotation);

    ctx.fillStyle = "yellow";
    ctx.beginPath();
    ctx.moveTo(-bulletLength / 2, -bulletWidth / 2);
    ctx.lineTo(bulletLength / 2, 0);
    ctx.lineTo(-bulletLength / 2, bulletWidth / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}


// Call updateBullets(dt) and drawBullets() inside your main loop




// ---------------------
// Drawing Functions
// ---------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------

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

function drawHands(ctx, size, type) {
    /*
    const LhandDistanceForward = size * 0.6;
    const LhandSideOffset = size * 0.52;
    const RhandDistanceForward = size * 0.6;
    const RhandSideOffset = size * 0.52;
    const handRadius = size * 0.415;
    */
   
    let LhandDistanceForward;
    let LhandSideOffset;
    let RhandDistanceForward;
    let RhandSideOffset;
    let handRadius;

    switch (type) {
        case 0:
            // Hands
            LhandDistanceForward = size * 0.6;
            LhandSideOffset = size * 0.52;
            RhandDistanceForward = size * 0.6;
            RhandSideOffset = size * 0.52;
            handRadius = size * 0.415;
            break;
        case 1:
            // Pistol style
            LhandDistanceForward = size * 0.75;
            LhandSideOffset = size * 0.4;
            RhandDistanceForward = size * 0.75;
            RhandSideOffset = size * 0.4;
            handRadius = size * 0.415;
            break;
        case 2:
            // Pistol style
            LhandDistanceForward = size * 0.75;
            LhandSideOffset = size * 0.4;
            RhandDistanceForward = size * 0.75;
            RhandSideOffset = size * 0.4;
            handRadius = size * 0.415;
            break;
        case 3:
            // Pistol style
            LhandDistanceForward = size * 0.75;
            LhandSideOffset = size * 0.4;
            RhandDistanceForward = size * 0.75;
            RhandSideOffset = size * 0.4;
            handRadius = size * 0.415;
            break;
        case 4:
            // Pistol style
            LhandDistanceForward = size * 0.75;
            LhandSideOffset = size * 0.4;
            RhandDistanceForward = size * 0.75;
            RhandSideOffset = size * 0.4;
            handRadius = size * 0.415;
            break;
        case 5:
            // Pistol style
            LhandDistanceForward = size * 0.75;
            LhandSideOffset = size * 0.4;
            RhandDistanceForward = size * 0.75;
            RhandSideOffset = size * 0.4;
            handRadius = size * 0.415;
            break;
        default:
            // Fallback if type is none of the above
            console.log("Unknown type");
    }


    const leftX = Math.cos(0) * LhandDistanceForward - Math.sin(0) * LhandSideOffset;
    const leftY = Math.sin(0) * LhandDistanceForward + Math.cos(0) * LhandSideOffset;

    const rightX = Math.cos(0) * RhandDistanceForward + Math.sin(0) * RhandSideOffset;
    const rightY = Math.sin(0) * RhandDistanceForward - Math.cos(0) * RhandSideOffset;

    ctx.fillStyle = '#cececeff';

    ctx.beginPath();
    ctx.arc(leftX, leftY, handRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(rightX, rightY, handRadius, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlayer(p) {
    const camX = camera.x;
    const camY = camera.y;

    const px = p.x - camX;
    const py = p.y - camY;

    const size = p.size;

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

    // Draw hands separately
    

    // Draw body
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Draw username
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '16px Consolas';
    ctx.textAlign = 'center';
    ctx.fillText(p.username || p.id.substring(0, 4), px, py - size - 20);
}




function drawGun(player, selectedItemIndex) {
    ctx.save();

    // Move origin to player's position
    ctx.translate(player.x - camera.x, player.y - camera.y);

    // Rotate to player's rotation
    ctx.rotate(player.rotation);

    size = player.size;

    switch (selectedItemIndex) {
        case 0: 
            // No weapon
            drawHands(ctx, size, selectedItemIndex);
            break;

        case 1: // Pistol
            drawHands(ctx, size, selectedItemIndex);
            ctx.fillStyle = "gray";
            ctx.fillRect(0, -4, 25, 8); // short barrel
            ctx.fillRect(-5, -4, 5, 8); // handle base
            break;

        case 2: // RPG
            drawHands(ctx, size, selectedItemIndex);
            ctx.fillStyle = "darkgreen";
            ctx.fillRect(0, -6, 45, 12); // launcher body
            ctx.fillStyle = "black";
            ctx.beginPath(); // warhead
            ctx.moveTo(45, -8);
            ctx.lineTo(55, 0);
            ctx.lineTo(45, 8);
            ctx.closePath();
            ctx.fill();
            break;

        case 3: // Pump Shotgun
            drawHands(ctx, size, selectedItemIndex);
            ctx.fillStyle = "saddlebrown";
            ctx.fillRect(0, -5, 40, 10); // main barrel
            ctx.fillStyle = "black";
            ctx.fillRect(15, -3, 10, 6); // pump grip
            break;

        case 4: // Grenade (in hand)
             drawHands(ctx, size, selectedItemIndex);
            ctx.fillStyle = "darkgreen";
            ctx.beginPath();
            ctx.arc(10, 0, 6, 0, Math.PI * 2); // grenade sphere
            ctx.fill();
            ctx.fillStyle = "gray";
            ctx.fillRect(6, -3, 4, 6); // fuse cap
            break;

        case 5: // Shield
             drawHands(ctx, size, selectedItemIndex);
            ctx.fillStyle = "steelblue";
            ctx.beginPath();
            ctx.arc(15, 0, 15, Math.PI / 2, -Math.PI / 2, false); // rounded front
            ctx.lineTo(0, -15);
            ctx.lineTo(0, 15);
            ctx.closePath();
            ctx.fill();
            break;
    }

    ctx.restore();
}






function drawPlayerCount() {
    const playerCount = Object.keys(remotePlayers).length + 1;
    ctx.fillStyle = 'white';
    ctx.font = '16px Consolas';
    ctx.fillText(`Players: ${playerCount}`, 55, 20);
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

    ctx.fillStyle = i === selectedItemIndex ? '#afafafff' : 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, slotSize, slotSize);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, slotSize, slotSize);

    ctx.fillStyle = 'white';
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hotbarItems[i], x + slotSize / 2, y + slotSize / 2);
  }
}

// ---------------------
// Main Loop
// ---------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------

function loop(timestamp = 0) {
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    update(dt);

    clear();

    if (player.id) {
        drawGun(player, selectedItemIndex);
        drawPlayer(player);
        
    }

    for (const id in remotePlayers) {
        drawGun(player);
        drawPlayer(remotePlayers[id]);

    }

    drawBullets();

    drawHotbar(ctx, canvas);
    drawPlayerCount();

    requestAnimationFrame(loop);
}

// ---------------------
// Input Handlers & Game Start
// ---------------------
//----------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------

document.getElementById("playBtn").addEventListener("click", () => {
    const usernameInput = document.getElementById("usernameInput");
    let username = usernameInput.value.trim();

    if (!username) {
        username = "Player";
    }

    player.username = username;

    document.getElementById("homeScreen").style.display = "none";
    canvas.style.display = "block";

    resizeCanvas();
    connectSocket();
    loop();

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
    window.addEventListener("mousedown", (event) => {


        switch (selectedItemIndex) {
            case 2:
                if (canAct) {
                    socket.emit("shootGun", {
                    x: player.x,
                    y: player.y,
                    type: 0,
                    rotation: player.rotation,
                    speed: 1500
                });
                }
                
                canAct = false;
                break;
            default:
                
        }




    });

    window.addEventListener("mouseup", () => {
        canAct = true; // allow shooting again on next mousedown
    });

});
