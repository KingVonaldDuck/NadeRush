const socket = io();

class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    create() {
        this.worldWidth   = 2000;
        this.worldHeight  = 2000;
        this.player       = null;
        this.bullets      = {};
        this.lastMoveSent = 0;

        this.keys          = this.input.keyboard.addKeys({ w:'W', a:'A', s:'S', d:'D' });
        this.weaponManager = new WeaponManager();
        this.hotbar        = new HotbarUI(this, this.weaponManager);
        this.grid          = new Grid(this);
        this.playerManager = new PlayerManager(this);
        this.bulletGroup   = this.physics.add.group();
        this.inputHandler  = new InputHandler(this, socket, this.weaponManager);

        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        this._setupSocketListeners();
        socket.emit('ready');
    }

    _setupSocketListeners() {
        const events = [
            'gameConfig', 'currentPlayers', 'playerJoined', 'playerMoved',
            'playerLeft', 'bulletFired', 'bulletRemoved', 'playerHit',
            'playerDied', 'playerRespawned',
        ];
        events.forEach(e => socket.off(e));

        socket.on('gameConfig', (config) => {
            this.worldWidth  = config.worldWidth;
            this.worldHeight = config.worldHeight;

            this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
            this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

            this.blockManager = new BlockManager(this, config.blockDefs);

            this.physics.add.collider(this.bulletGroup, this.blockManager.group, (bulletSprite) => {
                const bullet = this.bullets[bulletSprite.bulletId];
                if (bullet) {
                    bullet.destroy();
                    delete this.bullets[bulletSprite.bulletId];
                }
            });
        });

        socket.on('currentPlayers', (players) => {
            Object.entries(players).forEach(([id, data]) => {
                if (id === socket.id) {
                    this.player = new Player(this, data.x, data.y);
                    this.player.setHealth(data.health);
                    this.cameras.main.startFollow(this.player.container, true, 1, 1);
                    this.cameras.main.removeBounds();
                    this.cameras.main.setZoom(Math.max(1, this.scale.width / 1920));

                    if (this.blockManager) {
                        this.physics.add.collider(this.player.container, this.blockManager.group);
                    }
                } else {
                    this.playerManager.spawn(id, data.x, data.y, data.health);
                }
            });
        });

        socket.on('playerJoined',   (data) => this.playerManager.spawn(data.id, data.x, data.y, data.health));
        socket.on('playerMoved',    (data) => this.playerManager.move(data.id, data.x, data.y, data.angle));
        socket.on('playerLeft',     (id)   => this.playerManager.remove(id));

        socket.on('bulletFired', (data) => {
            // Use WeaponManager to look up color + speed so remote bullets
            // match the server simulation exactly
            const weapon = this.weaponManager.getByKey(data.weapon);
            const color  = weapon?.color       || 0xffff00;
            const speed  = weapon?.bulletSpeed || 600;
            const bullet = new Bullet(this, data.x, data.y, data.angle, data.ownerId, data.id, color, speed);
            this.bullets[data.id] = bullet;
        });

        socket.on('bulletRemoved', (data) => {
            const bullet = this.bullets[data.id];
            if (bullet) {
                bullet.destroy();
                delete this.bullets[data.id];
            }
        });

        socket.on('playerHit', (data) => {
            if (data.id === socket.id) {
                this.player?.setHealth(data.health);
            } else {
                this.playerManager.setHealth(data.id, data.health);
            }
        });

        socket.on('playerDied',     (_data) => { /* hook for kill feed */ });

        socket.on('playerRespawned', (data) => {
            if (data.id === socket.id) {
                this.player?.respawn(data.x, data.y, data.health);
            } else {
                this.playerManager.respawn(data.id, data.x, data.y, data.health);
            }
        });
    }

    update() {
        if (!this.player) return;

        const cam      = this.cameras.main;
        const pointer  = this.input.activePointer;
        const aimAngle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            pointer.x + cam.scrollX,
            pointer.y + cam.scrollY
        );

        this.player.update(this.keys, aimAngle);
        this.inputHandler.tryAutoFire();

        const now = Date.now();
        if (now - this.lastMoveSent >= 1000 / 30) {
            socket.emit('playerMove', { x: this.player.x, y: this.player.y, angle: aimAngle });
            this.lastMoveSent = now;
        }

        for (const [id, bullet] of Object.entries(this.bullets)) {
            const s = bullet.sprite;
            if (!s.active || s.x < 0 || s.x > this.worldWidth || s.y < 0 || s.y > this.worldHeight) {
                bullet.destroy();
                delete this.bullets[id];
            }
        }

        this.grid.draw();
    }
}

new Phaser.Game({
    type: Phaser.AUTO,
    backgroundColor: '#222',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false },
    },
    scene: MainScene,
});
