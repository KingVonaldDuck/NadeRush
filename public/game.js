const socket = io(); // connect to server

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let playerIndex = null;
const inputs = { w:false, a:false, s:false, d:false, angle:0 };
let state = [null, null]; // 2 players

// --- INPUT HANDLERS ---
window.addEventListener('keydown', e => {
    if(inputs.hasOwnProperty(e.key)) inputs[e.key] = true;
});
window.addEventListener('keyup', e => {
    if(inputs.hasOwnProperty(e.key)) inputs[e.key] = false;
});
canvas.addEventListener('mousemove', e => {
    inputs.angle = Math.atan2(e.clientY - canvas.height/2, e.clientX - canvas.width/2);
});

// --- SOCKET EVENTS ---
socket.on('playerData', data => playerIndex = data.index);
socket.on('state', players => state = players);

// Send inputs 60 times/sec
setInterval(() => {
    if(playerIndex !== null) socket.emit('inputs', inputs);
}, 1000/60);

// --- DRAW FUNCTIONS ---
function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const offsetX = state[playerIndex]?.x - canvas.width/2 || 0;
    const offsetY = state[playerIndex]?.y - canvas.height/2 || 0;

    ctx.strokeStyle = '#525';
    ctx.lineWidth = 1;
    const gridSize = 50;

    for(let x=0;x<=1000;x+=gridSize){
        ctx.beginPath();
        ctx.moveTo(x - offsetX, -offsetY);
        ctx.lineTo(x - offsetX, 1000 - offsetY);
        ctx.stroke();
    }

    for(let y=0;y<=1000;y+=gridSize){
        ctx.beginPath();
        ctx.moveTo(-offsetX, y - offsetY);
        ctx.lineTo(1000 - offsetX, y - offsetY);
        ctx.stroke();
    }
}

function drawPlayer(p, color='#fff') {
    if(!p) return;
    const offsetX = state[playerIndex]?.x - canvas.width/2 || 0;
    const offsetY = state[playerIndex]?.y - canvas.height/2 || 0;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x - offsetX, p.y - offsetY, p.radius, 0, Math.PI*2);
    ctx.fill();
}

function drawHands(p, color='#bebebeff') {
    if(!p) return;
    const offsetX = state[playerIndex]?.x - canvas.width/2 || 0;
    const offsetY = state[playerIndex]?.y - canvas.height/2 || 0;

    const handDistance = 14;
    const handSpacing = 22;
    const handRadius = 8;

    const frontX = p.x - offsetX + Math.cos(p.angle)*handDistance;
    const frontY = p.y - offsetY + Math.sin(p.angle)*handDistance;

    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.arc(frontX + Math.cos(p.angle + Math.PI/2)*handSpacing/2,
            frontY + Math.sin(p.angle + Math.PI/2)*handSpacing/2,
            handRadius,0,Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(frontX + Math.cos(p.angle - Math.PI/2)*handSpacing/2,
            frontY + Math.sin(p.angle - Math.PI/2)*handSpacing/2,
            handRadius,0,Math.PI*2);
    ctx.fill();
}

// --- MAIN DRAW LOOP ---
function draw() {
    drawBackground();

    if(state[playerIndex]) drawHands(state[playerIndex], '#d1d1d1ff');
    const otherIndex = playerIndex === 0 ? 1 : 0;
    if(state[otherIndex]) drawHands(state[otherIndex], '#d1d1d1ff');

    if(state[playerIndex]) drawPlayer(state[playerIndex], '#ffffffff');
    if(state[otherIndex]) drawPlayer(state[otherIndex], 'rgba(255, 255, 255, 1)');

    requestAnimationFrame(draw);
}

draw();
