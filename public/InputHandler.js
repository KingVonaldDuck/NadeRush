class InputHandler {
    constructor(scene, socket, weaponManager) {
        this.scene         = scene;
        this.socket        = socket;
        this.weaponManager = weaponManager;
        this.lastShotTimes = { ar: 0, sniper: 0, shotgun: 0 };

        scene.input.keyboard.on('keydown', (e) => {
            if (e.key >= '1' && e.key <= '4') {
                weaponManager.switch(parseInt(e.key));
                scene.updateWeaponUI();
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

        const now = Date.now();
        if (now - (this.lastShotTimes[weapon.key] || 0) < weapon.rateMs) return;
        this.lastShotTimes[weapon.key] = now;

        const scene  = this.scene;
        const cam    = scene.cameras.main;
        const worldX = pointer.x + cam.scrollX;
        const worldY = pointer.y + cam.scrollY;
        const angle  = Phaser.Math.Angle.Between(scene.player.x, scene.player.y, worldX, worldY);

        const bulletId = `${this.socket.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const bullet   = new Bullet(scene, scene.player.x, scene.player.y, angle, this.socket.id, bulletId, weapon.color, weapon.bulletSpeed);
        scene.bullets[bulletId] = bullet;

        this.socket.emit('bulletFired', { id: bulletId, angle, weapon: weapon.key });
    }
}