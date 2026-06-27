class InputHandler {
    constructor(scene, socket) {
        this.scene  = scene;
        this.socket = socket;

        scene.input.on('pointerdown', (pointer) => {
            if (!scene.player) return;

            const cam    = scene.cameras.main;
            const worldX = pointer.x + cam.scrollX;
            const worldY = pointer.y + cam.scrollY;

            const angle = Phaser.Math.Angle.Between(
                scene.player.x, scene.player.y,
                worldX, worldY
            );

            new Bullet(scene, scene.player.x, scene.player.y, angle, socket.id);

            socket.emit('bulletFired', {
                x: scene.player.x,
                y: scene.player.y,
                angle: angle
            });
        });
    }
}