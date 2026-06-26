const socket = io();

const otherPlayers = {};

class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene");
    }

    create() {
        this.worldWidth  = 2000;
        this.worldHeight = 2000;

        this.grid = this.add.graphics().setDepth(-10);

        this.keys = this.input.keyboard.addKeys({ w:"W", a:"A", s:"S", d:"D" });

        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        this.blockGroup = this.physics.add.staticGroup();

        this.blocks = [
            { x: 400, y: 400, w: 200, h: 40 },
            { x: 1200, y: 600, w: 120, h: 200 },
            { x: 1200, y: 320, w: 300, h: 80 },
            { x: 280, y: 720, w: 360, h: 40 },
            { x: 440, y: 560, w: 40, h: 360 },
            { x: 480, y: 560, w: 160, h: 40 },
            { x: 280, y: 880, w: 160, h: 40 },
            { x: 600, y: 760, w: 40, h: 160 },
            { x: 280, y: 560, w: 40, h: 160 },
        ];

        for (const b of this.blocks) {
            const rect = this.add.rectangle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, 0x8700a1).setDepth(-1);
            this.physics.add.existing(rect, true);
            this.blockGroup.add(rect);
        }

        socket.on('currentPlayers', (players) => {
            Object.entries(players).forEach(([id, data]) => {
                if (id === socket.id) {
                    this.player = new Player(this, data.x, data.y);
                    this.cameras.main.startFollow(this.player.container, true, 0.1, 0.1);
                    this.physics.add.collider(this.player.container, this.blockGroup);
                } else {
                    this.spawnOtherPlayer(id, data.x, data.y);
                }
            });
        });

        socket.on('playerJoined', (data) => {
            this.spawnOtherPlayer(data.id, data.x, data.y);
        });

        socket.on('playerMoved', (data) => {
            const op = otherPlayers[data.id];
            if (!op) return;
            op.container.x = data.x;
            op.container.y = data.y;
            op.updateHands(data.angle);
        });

        socket.on('playerLeft', (id) => {
            const op = otherPlayers[id];
            if (!op) return;
            op.container.destroy();
            delete otherPlayers[id];
        });

        socket.emit('ready');
    }

    spawnOtherPlayer(id, x, y) {
        const op = new Player(this, x, y);
        op.circle.setFillStyle(0xff6666);
        otherPlayers[id] = op;
    }

    update() {
        if (!this.player) return;

        const cam     = this.cameras.main;
        const pointer = this.input.activePointer;

        const worldX = pointer.x + cam.scrollX;
        const worldY = pointer.y + cam.scrollY;

        const aimAngle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            worldX, worldY
        );

        this.player.update(this.keys, aimAngle);

        socket.emit('playerInput', {
            left:  this.keys.a.isDown,
            right: this.keys.d.isDown,
            up:    this.keys.w.isDown,
            down:  this.keys.s.isDown,
            angle: aimAngle
        });

        this.drawGrid();
    }

    drawGrid() {
        this.grid.clear();
        this.grid.lineStyle(1, 0x444444, 1);

        const spacing = 40;
        const cam     = this.cameras.main;

        const left   = cam.scrollX - spacing;
        const top    = cam.scrollY - spacing;
        const right  = cam.scrollX + cam.width  + spacing;
        const bottom = cam.scrollY + cam.height + spacing;

        const startX = Math.floor(left / spacing) * spacing;
        const startY = Math.floor(top  / spacing) * spacing;

        for (let x = startX; x <= right; x += spacing) {
            this.grid.beginPath();
            this.grid.moveTo(x, top);
            this.grid.lineTo(x, bottom);
            this.grid.strokePath();
        }
        for (let y = startY; y <= bottom; y += spacing) {
            this.grid.beginPath();
            this.grid.moveTo(left, y);
            this.grid.lineTo(right, y);
            this.grid.strokePath();
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#222",
    physics: {
        default: "arcade",
        arcade: { debug: false }
    },
    scene: MainScene
};

const game = new Phaser.Game(config);