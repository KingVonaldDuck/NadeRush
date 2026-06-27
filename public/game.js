const socket = io();

class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene");
    }

    create() {
        this.worldWidth  = 2000;
        this.worldHeight = 2000;

        this.keys = this.input.keyboard.addKeys({ w:"W", a:"A", s:"S", d:"D" });

        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        this.grid          = new Grid(this);
        this.blockManager  = new BlockManager(this);
        this.playerManager = new PlayerManager(this);
        this.inputHandler  = new InputHandler(this, socket);
        this.bulletGroup   = this.physics.add.group();

        // bullet vs block
        this.physics.add.collider(this.bulletGroup, this.blockManager.group, (bulletSprite) => {
            bulletSprite.destroy();
        });

        // socket events
        socket.on('bulletFired', (data) => {
            new Bullet(this, data.x, data.y, data.angle, data.id);
        });

        socket.on('currentPlayers', (players) => {
            Object.entries(players).forEach(([id, data]) => {
                if (id === socket.id) {
                    this.player = new Player(this, data.x, data.y);
                    this.cameras.main.startFollow(this.player.container, true, 0.1, 0.1);
                    this.physics.add.collider(this.player.container, this.blockManager.group);
                } else {
                    this.playerManager.spawn(id, data.x, data.y);
                }
            });
        });

        socket.on('playerJoined', (data) => {
            this.playerManager.spawn(data.id, data.x, data.y);
        });

        socket.on('playerMoved', (data) => {
            this.playerManager.move(data.id, data.x, data.y, data.angle);
        });

        socket.on('playerLeft', (id) => {
            this.playerManager.remove(id);
        });

        socket.emit('ready');
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

        socket.emit('playerMove', {
            x: this.player.x,
            y: this.player.y,
            angle: aimAngle
        });

        this.bulletGroup.getChildren().forEach(sprite => {
            if (
                sprite.x < 0 || sprite.x > this.worldWidth ||
                sprite.y < 0 || sprite.y > this.worldHeight
            ) {
                sprite.destroy();
            }
        });

        this.grid.draw();
    }
}

const config = {
    type: Phaser.AUTO,
    backgroundColor: "#222",
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
    },
    physics: {
        default: "arcade",
        arcade: { debug: false }
    },
    scene: MainScene
};

const game = new Phaser.Game(config);