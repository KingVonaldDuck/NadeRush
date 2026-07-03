class InputHandler {
    constructor(scene, socket, weaponManager) {
        this.scene         = scene;
        this.socket        = socket;
        this.weaponManager = weaponManager;
        this.lastShotTimes = {};  // keyed by weapon.key, populated on first shot

    scene.input.keyboard.on('keydown', (e) => {
        const num = parseInt(e.key);
        if (num >= 1 && num <= Object.keys(weaponManager.weapons).length) {
            weaponManager.switch(num);
            scene.hotbar.refresh();

            const baseZoom = Math.max(1, scene.scale.width / 1920);
            scene.cameras.main.setZoom(baseZoom * weaponManager.get().zoom);
        }
    });

        scene.input.on('pointerdown', (pointer) => {
            if (!scene.player || scene.player.health <= 0) return;
            if (!weaponManager.get().auto) this._fire(pointer);
        });
    }

    tryAutoFire() {
        if (!this.scene.player || this.scene.player.health <= 0) return;
        if (!this.weaponManager.get().auto) return;
        if (!this.scene.input.activePointer.isDown) return;
        this._fire(this.scene.input.activePointer);
    }

    _fire(pointer) {
        const weapon = this.weaponManager.get();
        if (weapon.key === 'melee') return;
        if (!weapon.canFire(this.lastShotTimes[weapon.key])) return;

        this.lastShotTimes[weapon.key] = Date.now();

        const scene  = this.scene;
        const cam    = scene.cameras.main;
        const angle  = Phaser.Math.Angle.Between(
            scene.player.x, scene.player.y,
            pointer.x + cam.scrollX,
            pointer.y + cam.scrollY
        );

        const bulletId = `${this.socket.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const bullet   = new Bullet(scene, scene.player.x, scene.player.y, angle, this.socket.id, bulletId, weapon.color, weapon.bulletSpeed);
        scene.bullets[bulletId] = bullet;

        this.socket.emit('bulletFired', { id: bulletId, angle, weapon: weapon.key });
    }
}
