class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        this.container = scene.add.container(x, y).setDepth(1);

        this.circle    = scene.add.circle(0, 0, 20, 0xffffff).setDepth(1);
        this.handLeft  = scene.add.circle(0, 0, 10, 0xcccccc).setDepth(0);
        this.handRight = scene.add.circle(0, 0, 10, 0xcccccc).setDepth(0);

        this.container.add([this.handLeft, this.handRight, this.circle]);

        scene.physics.world.enable(this.container);
        this.container.body.setCircle(20, -20, -20);
        this.container.body.setCollideWorldBounds(true);

        this.health = 100;
        this.speed = 3.5;
    }

    update(keys, aimAngle) {
        const dx = (keys.d.isDown ? 1 : 0) - (keys.a.isDown ? 1 : 0);
        const dy = (keys.s.isDown ? 1 : 0) - (keys.w.isDown ? 1 : 0);

        this.container.body.setVelocity(dx * this.speed * 60, dy * this.speed * 60);

        this.updateHands(aimAngle);
    }

    updateHands(angle) {
        const handDist   = 11;
        const handOffset = 10;

        const perpX = Math.cos(angle + Math.PI / 2);
        const perpY = Math.sin(angle + Math.PI / 2);
        const fwdX  = Math.cos(angle);
        const fwdY  = Math.sin(angle);

        this.handLeft.x  = perpX * handOffset + fwdX * handDist;
        this.handLeft.y  = perpY * handOffset + fwdY * handDist;
        this.handRight.x = -perpX * handOffset + fwdX * handDist;
        this.handRight.y = -perpY * handOffset + fwdY * handDist;
    }

    get x() { return this.container.x; }
    get y() { return this.container.y; }
}