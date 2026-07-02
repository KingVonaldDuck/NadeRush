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

        this.keys = this.input.keyboard.addKeys({ w:'W', a:'A', s:'S', d:'D' });

        this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        this.grid          = new Grid(this);
        this.playerManager = new PlayerManager(this);
        this.bulletGroup   = this.physics.add.group();
        this.weaponManager = new WeaponManager();
        this.inputHandler  = new InputHandler(this, socket, this.weaponManager);

        this._buildWeaponUI();
        this._setupSocketListeners();
        socket.emit('ready');
    }

    _buildWeaponUI() {
        this._hotbarSlots = [];

        const slotSize  = 64;
        const padding   = 8;
        const count     = 4;
        const totalW    = count * slotSize + (count - 1) * padding;

        // Anchored to bottom-right; repositioned in updateWeaponUI based on camera size
        const weapons = this.weaponManager.weapons;

        for (let i = 0; i < count; i++) {
            const n      = i + 1;
            const weapon = weapons[n];

            // Slot background
            const bg = this.add.rectangle(0, 0, slotSize, slotSize, 0x000000, 0.7)
                .setStrokeStyle(2, 0x888888)
                .setScrollFactor(0)
                .setDepth(10);

            // Weapon color swatch
            const swatch = this.add.rectangle(0, 0, slotSize - 20, slotSize - 28, weapon.color, 1)
                .setScrollFactor(0)
                .setDepth(11);

            // Weapon name
            const label = this.add.text(0, 0, weapon.name, {
                fontSize: '12px', fill: '#ffffff', align: 'center'
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(11);

            // Key number
            const keyLabel = this.add.text(0, 0, `${n}`, {
                fontSize: '11px', fill: '#aaaaaa'
            }).setOrigin(0, 0).setScrollFactor(0).setDepth(11);

            this._hotbarSlots.push({ bg, swatch, label, keyLabel });
        }

        this.updateWeaponUI();

        // Reposition on resize
        this.scale.on('resize', () => this.updateWeaponUI());
    }

    updateWeaponUI() {
        const slotSize = 64;
        const padding  = 8;
        const count    = 4;
        const totalW   = count * slotSize + (count - 1) * padding;
        const W        = this.scale.width;
        const H        = this.scale.height;
        const startX   = W - totalW - 16;
        const y        = H - slotSize - 16;

        this._hotbarSlots.forEach((slot, i) => {
            const n       = i + 1;
            const cx      = startX + i * (slotSize + padding) + slotSize / 2;
            const active  = n === this.weaponManager.current;

            slot.bg.setPosition(cx, y + slotSize / 2);
            slot.bg.setStrokeStyle(2, active ? 0xffffff : 0x555555);
            slot.bg.setFillStyle(0x000000, active ? 0.9 : 0.5);

            slot.swatch.setPosition(cx, y + slotSize / 2 - 8);
            slot.swatch.setAlpha(active ? 1 : 0.4);

            slot.label.setPosition(cx, y + slotSize - 18);
            slot.label.setAlpha(active ? 1 : 0.5);

            slot.keyLabel.setPosition(cx - slotSize / 2 + 4, y + 4);
        });
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
                const id = bulletSprite.bulletId;
                if (id && this.bullets[id]) {
                    this.bullets[id].destroy();
                    delete this.bullets[id];
                }
            });
        });

        socket.on('currentPlayers', (players) => {
            Object.entries(players).forEach(([id, data]) => {
                if (id === socket.id) {
                    this.player = new Player(this, data.x, data.y);
                    this.player.setHealth(data.health);
                    this.cameras.main.startFollow(this.player.container, true, 0.1, 0.1);
                    if (this.blockManager) {
                        this.physics.add.collider(this.player.container, this.blockManager.group);
                    }
                } else {
                    this.playerManager.spawn(id, data.x, data.y, data.health);
                }
            });
        });

        socket.on('playerJoined', (data) => {
            this.playerManager.spawn(data.id, data.x, data.y, data.health);
        });

        socket.on('playerMoved', (data) => {
            this.playerManager.move(data.id, data.x, data.y, data.angle);
        });

        socket.on('playerLeft', (id) => {
            this.playerManager.remove(id);
        });

        socket.on('bulletFired', (data) => {
            // Use the weapon color if provided, fallback to yellow
            const colorMap = { ar: 0xffff00, sniper: 0x00ffff, shotgun: 0xff8800 };
            const color = colorMap[data.weapon] || 0xffff00;
            const bullet = new Bullet(this, data.x, data.y, data.angle, data.ownerId, data.id, color);
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

        socket.on('playerDied', (_data) => {
            // Hook for kill feed etc.
        });

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
        const worldX   = pointer.x + cam.scrollX;
        const worldY   = pointer.y + cam.scrollY;
        const aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldX, worldY);

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

const config = {
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
};

new Phaser.Game(config);