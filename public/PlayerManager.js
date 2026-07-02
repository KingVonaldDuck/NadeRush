class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.players = {};
    }

    spawn(id, x, y, health = 100) {
        const player = new Player(this.scene, x, y);
        player.circle.setFillStyle(0xff6666);
        player.setHealth(health);
        this.players[id] = player;
    }

    remove(id) {
        const player = this.players[id];
        if (!player) return;
        player.container.destroy();
        delete this.players[id];
    }

    move(id, x, y, angle) {
        const player = this.players[id];
        if (!player) return;
        player.container.x = x;
        player.container.y = y;
        player.updateHands(angle);
    }

    setHealth(id, health) {
        const player = this.players[id];
        if (!player) return;
        player.setHealth(health);
    }

    respawn(id, x, y, health) {
        const player = this.players[id];
        if (!player) return;
        player.respawn(x, y, health);
    }

    removeAll() {
        Object.keys(this.players).forEach(id => this.remove(id));
    }
}