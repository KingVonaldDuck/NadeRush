class Block {
    constructor(scene, x, y, w, h, color = 0x8700a1) {
        this.scene = scene;
        this.rect = scene.add.rectangle(x + w / 2, y + h / 2, w, h, color).setDepth(-1);
        scene.physics.add.existing(this.rect, true);
    }
}