class BlockManager {
    constructor(scene, blockDefs = []) {
        this.scene     = scene;
        this.blockDefs = blockDefs;
        this.group     = scene.physics.add.staticGroup();

        for (const b of this.blockDefs) {
            const block = new Block(scene, b.x, b.y, b.w, b.h);
            this.group.add(block.rect);
        }
    }
}