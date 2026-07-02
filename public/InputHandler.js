class InputHandler {
    constructor(scene, socket) {
        this.scene  = scene;
        this.socket = socket;

        scene.input.on('pointerdown', (pointer) => {
            if (!scene.player || scene.player.health <= 0) return;

            const cam    = scene.cameras.main;
            const worldX = pointer.x + cam.scrollX;
            const worldY = pointer.y + cam.scrollY;

            const angle = Phaser.Math.Angle.Between(
                scene.player.x, scene.player.y,
                worldX, worldY
            );

            const bulletId = `${socket.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // Spawn locally right away for instant feedback; the server
            // owns this bullet's actual simulation and hit detection from
            // here and will tell every client (including us) when it dies.
            const bullet = new Bullet(scene, scene.player.x, scene.player.y, angle, socket.id, bulletId);
            scene.bullets[bulletId] = bullet;

            socket.emit('bulletFired', {
                id: bulletId,
                angle: angle
            });
        });
    }
}