class BlockManager {
    constructor(scene) {
        this.scene = scene;
        this.group = scene.physics.add.staticGroup();

        this.blockDefs = [
            { x: 400, y: 400, w: 200, h: 40 },
            { x: 1200, y: 600, w: 120, h: 200 },
            { x: 1200, y: 320, w: 300, h: 80 },
            { x: 280, y: 720, w: 360, h: 40 },
            { x: 440, y: 560, w: 40, h: 360 },
            { x: 480, y: 560, w: 160, h: 40 },
            { x: 280, y: 880, w: 160, h: 40 },
            { x: 600, y: 760, w: 40, h: 160 },
            { x: 280, y: 560, w: 40, h: 160 },
        ];

        for (const b of this.blockDefs) {
            const block = new Block(scene, b.x, b.y, b.w, b.h);
            this.group.add(block.rect);
        }
    }
}