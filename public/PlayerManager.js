class PlayerManager {
    constructor(scene) {
        this.scene = scene;
        this.players = {};
    }

    spawn(id, x, y) {
        const player = new Player(this.scene, x, y);
        player.circle.setFillStyle(0xff6666);
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

    removeAll() {
        Object.keys(this.players).forEach(id => this.remove(id));
    }
}