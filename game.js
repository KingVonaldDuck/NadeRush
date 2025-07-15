const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const worldSize = 3000;

const player = {
  x: 1000, // player position in the world
  y: 1000,
  size: 20,
  speed: 4,
  dx: 0,
  dy: 0,
  color: "white",
};

const camera = {
  x: 0,
  y: 0
};

// Resize canvas to full screen
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  updateCamera();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Call once at the start

// --- Movement Controls ---
function keyDownHandler(e) {
  if (e.key === "ArrowRight" || e.key === "d") {
    player.dx = player.speed;
  } else if (e.key === "ArrowLeft" || e.key === "a") {
    player.dx = -player.speed;
  } else if (e.key === "ArrowUp" || e.key === "w") {
    player.dy = -player.speed;
  } else if (e.key === "ArrowDown" || e.key === "s") {
    player.dy = player.speed;
  }
}

function keyUpHandler(e) {
  if (["ArrowRight", "d", "ArrowLeft", "a"].includes(e.key)) {
    player.dx = 0;
  }
  if (["ArrowUp", "w", "ArrowDown", "s"].includes(e.key)) {
    player.dy = 0;
  }
}

document.addEventListener("keydown", keyDownHandler);
document.addEventListener("keyup", keyUpHandler);

// --- Camera update function ---
function updateCamera() {
  camera.x = player.x - canvas.width / 2;
  camera.y = player.y - canvas.height / 2;
}

// --- Game Logic ---
function update() {
  player.x += player.dx;
  player.y += player.dy;

  // Keep player inside the world boundaries
  player.x = Math.max(player.size, Math.min(worldSize - player.size, player.x));
  player.y = Math.max(player.size, Math.min(worldSize - player.size, player.y));

  updateCamera();
}

// --- Drawing ---
function drawPlayer() {
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(
    player.x - camera.x,
    player.y - camera.y,
    player.size,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function clear() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw background color
  ctx.fillStyle = "#444";
  ctx.fillRect(-camera.x, -camera.y, worldSize, worldSize);

  // Draw grid lines
  const gridSize = 50; // size of each grid square

  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = -camera.x % gridSize; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = -camera.y % gridSize; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}


// --- Main Loop ---
function loop() {
  clear();
  update();
  drawPlayer();
  requestAnimationFrame(loop);
}

loop();
