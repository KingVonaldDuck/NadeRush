class Bullet {
    constructor(scene, x, y, angle, ownerId = null, id = null) {
        this.scene = scene;
        this.ownerId = ownerId;
        this.id = id;
        this.damage = 10;

        this.sprite = scene.add.circle(x, y, 5, 0xffff00).setDepth(0);
        this.sprite.bulletId = id;
        scene.physics.world.enable(this.sprite);
        this.sprite.body.setCircle(5, -5, -5);

        scene.bulletGroup.add(this.sprite);

        const speed = 600;
        this.sprite.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );
    }

    destroy() {
        this.sprite.destroy();
    }
}