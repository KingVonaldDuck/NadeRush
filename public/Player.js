class Player {
    constructor(scene, x, y) {
        this.scene = scene;

        this.container = scene.add.container(x, y);

        this.circle    = scene.add.circle(0, 0, 20, 0xffffff).setDepth(1);
        this.handLeft  = scene.add.circle(0, 0, 10, 0xcccccc);
        this.handRight = scene.add.circle(0, 0, 10, 0xcccccc);

        this.healthBarBg = scene.add.rectangle(0, -34, 40, 6, 0x222222).setDepth(2);
        this.healthBarFg = scene.add.rectangle(-20, -34, 40, 6, 0x44ff44).setOrigin(0, 0.5).setDepth(2);

        this.container.add([this.handLeft, this.handRight, this.circle, this.healthBarBg, this.healthBarFg]);

        scene.physics.world.enable(this.container);
        this.container.body.setCircle(20, -20, -20);
        this.container.body.setCollideWorldBounds(true);

        this.health = 100;
        this.speed  = 4;
    }

    update(keys, aimAngle) {
        if (this.health <= 0) {
            // Stop dead players from drifting
            this.container.body.setVelocity(0, 0);
            return;
        }

        let dx = (keys.d.isDown ? 1 : 0) - (keys.a.isDown ? 1 : 0);
        let dy = (keys.s.isDown ? 1 : 0) - (keys.w.isDown ? 1 : 0);

        // Normalize diagonals so they don't move ~41% faster than cardinal directions
        if (dx !== 0 && dy !== 0) {
            dx *= Math.SQRT1_2;
            dy *= Math.SQRT1_2;
        }

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

        this.handLeft.x  =  perpX * handOffset + fwdX * handDist;
        this.handLeft.y  =  perpY * handOffset + fwdY * handDist;
        this.handRight.x = -perpX * handOffset + fwdX * handDist;
        this.handRight.y = -perpY * handOffset + fwdY * handDist;
    }

    setHealth(health) {
        this.health = health;
        const pct = Math.max(0, health) / 100;
        this.healthBarFg.width      = 40 * pct;
        this.healthBarFg.fillColor  = pct > 0.5 ? 0x44ff44 : (pct > 0.25 ? 0xffaa00 : 0xff4444);
    }

    respawn(x, y, health) {
        this.container.x = x;
        this.container.y = y;
        this.setHealth(health);
    }

    get x() { return this.container.x; }
    get y() { return this.container.y; }
}