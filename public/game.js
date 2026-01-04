const socket = io();

// --- CANVAS ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- GAME STATE ---
let playerIndex = null;
let roomId = null;
const inputs = { w:false, a:false, s:false, d:false, angle:0, emote: false };
let state = [null, null];

// --- INPUT ---
window.addEventListener('keydown', e => {
    if (inputs.hasOwnProperty(e.key)) inputs[e.key] = true;
});
window.addEventListener('keyup', e => {
    if (inputs.hasOwnProperty(e.key)) inputs[e.key] = false;
});
canvas.addEventListener('mousemove', e => {
    inputs.angle = Math.atan2(
        e.clientY - canvas.height / 2,
        e.clientX - canvas.width / 2
    );
});

canvas.addEventListener('contextmenu', e => e.preventDefault()); // disable menu

canvas.addEventListener('mousedown', e => {
    if (e.button === 2) { // right-click
        inputs.emote = true; // activate emote
    }
});

canvas.addEventListener('mouseup', e => {
    if (e.button === 2) {
        inputs.emote = false; // deactivate emote when released
    }
});


// --- SOCKET EVENTS ---
socket.emit('join_game');

socket.on('waiting', () => {
    console.log('Waiting for opponent...');
});

socket.on('game_start', data => {
    playerIndex = data.index;
    roomId = data.roomId;
});

socket.on('state', players => {
    state = players;
});

socket.on('opponent_left', () => {
    // Reset local state
    playerIndex = null;
    roomId = null;
    state = [null, null];

    // Rejoin matchmaking
    socket.emit('join_game');
});

// --- SEND INPUTS ---
setInterval(() => {
    if (roomId !== null && playerIndex !== null) {
        socket.emit('inputs', inputs);
    }
}, 1000 / 120);

// --- DRAWING ---

// emote

const emoteCRYimage = new Image();
emoteCRYimage.src = 'emoteCRY.png'; // put the image in your public folder


function drawEmote(p) {
    if (!p || !p.emote) return;

    const offsetX = state[playerIndex].x - canvas.width / 2;
    const offsetY = state[playerIndex].y - canvas.height / 2;

    const x = p.x - offsetX;
    const y = p.y - offsetY - 70; // above player
    const size = 125; // size of the emote

    ctx.drawImage(emoteCRYimage, x - size / 2, y - size / 2, size, size);
}





function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!state[playerIndex]) return;

    const offsetX = state[playerIndex].x - canvas.width / 2;
    const offsetY = state[playerIndex].y - canvas.height / 2;

    ctx.strokeStyle = 'rgba(73,20,73,1)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= 1000; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x - offsetX, -offsetY);
        ctx.lineTo(x - offsetX, 1000 - offsetY);
        ctx.stroke();
    }

    for (let y = 0; y <= 1000; y += 40) {
        ctx.beginPath();
        ctx.moveTo(-offsetX, y - offsetY);
        ctx.lineTo(1000 - offsetX, y - offsetY);
        ctx.stroke();
    }
}

function drawPlayer(p, color) {
    if (!p || !state[playerIndex]) return;

    const offsetX = state[playerIndex].x - canvas.width / 2;
    const offsetY = state[playerIndex].y - canvas.height / 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x - offsetX, p.y - offsetY, p.radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawHands(p) {
    if (!p || !state[playerIndex]) return;

    const offsetX = state[playerIndex].x - canvas.width / 2;
    const offsetY = state[playerIndex].y - canvas.height / 2;

    const frontX = p.x - offsetX + Math.cos(p.angle) * 14;
    const frontY = p.y - offsetY + Math.sin(p.angle) * 14;

    ctx.fillStyle = '#d1d1d1';

    for (let s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(
            frontX + Math.cos(p.angle + s * Math.PI / 2) * 11,
            frontY + Math.sin(p.angle + s * Math.PI / 2) * 11,
            8,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
}

function draw() {
    drawBackground();

    const other = playerIndex === 0 ? 1 : 0;

    drawHands(state[playerIndex]);
    drawHands(state[other]);

    drawPlayer(state[playerIndex], '#fff');
    drawPlayer(state[other], '#fff');

    drawEmote(state[playerIndex]);
    drawEmote(state[other]);

    requestAnimationFrame(draw);
}

draw();
