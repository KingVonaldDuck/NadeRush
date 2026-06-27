class Grid {
    constructor(scene) {
        this.scene = scene;
        this.graphics = scene.add.graphics().setDepth(-10);
    }

    draw() {
        this.graphics.clear();
        this.graphics.lineStyle(1, 0x444444, 1);

        const spacing = 40;
        const cam     = this.scene.cameras.main;

        const left   = cam.scrollX - spacing;
        const top    = cam.scrollY - spacing;
        const right  = cam.scrollX + cam.width  + spacing;
        const bottom = cam.scrollY + cam.height + spacing;

        const startX = Math.floor(left / spacing) * spacing;
        const startY = Math.floor(top  / spacing) * spacing;

        for (let x = startX; x <= right; x += spacing) {
            this.graphics.beginPath();
            this.graphics.moveTo(x, top);
            this.graphics.lineTo(x, bottom);
            this.graphics.strokePath();
        }
        for (let y = startY; y <= bottom; y += spacing) {
            this.graphics.beginPath();
            this.graphics.moveTo(left, y);
            this.graphics.lineTo(right, y);
            this.graphics.strokePath();
        }
    }
}