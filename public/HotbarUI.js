class HotbarUI {
    constructor(scene, weaponManager) {
        this.scene         = scene;
        this.weaponManager = weaponManager;
        this._slots        = [];

        this._build();
        scene.scale.on('resize', () => this.refresh());
    }

    _build() {
        const weapons = this.weaponManager.weapons;
        const count   = Object.keys(weapons).length;

        for (let i = 0; i < count; i++) {
            const n      = i + 1;
            const weapon = weapons[n];

            const bg = this.scene.add.rectangle(0, 0, 64, 64, 0x000000, 0.7)
                .setStrokeStyle(2, 0x888888)
                .setScrollFactor(0)
                .setDepth(10);

            const swatch = this.scene.add.rectangle(0, 0, 44, 36, weapon.color, 1)
                .setScrollFactor(0)
                .setDepth(11);

            const label = this.scene.add.text(0, 0, weapon.name, {
                fontSize: '12px', fill: '#ffffff', align: 'center',
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(11);

            const keyLabel = this.scene.add.text(0, 0, `${n}`, {
                fontSize: '11px', fill: '#aaaaaa',
            }).setOrigin(0, 0).setScrollFactor(0).setDepth(11);

            this._slots.push({ bg, swatch, label, keyLabel });
        }

        this.refresh();
    }

    refresh() {
        const slotSize = 64;
        const padding  = 8;
        const count    = this._slots.length;
        const totalW   = count * slotSize + (count - 1) * padding;
        const W        = this.scene.scale.width;
        const H        = this.scene.scale.height;
        const startX   = W - totalW - 16;
        const y        = H - slotSize - 16;

        this._slots.forEach((slot, i) => {
            const n      = i + 1;
            const cx     = startX + i * (slotSize + padding) + slotSize / 2;
            const active = n === this.weaponManager.current;

            slot.bg.setPosition(cx, y + slotSize / 2);
            slot.bg.setStrokeStyle(2, active ? 0xffffff : 0x555555);
            slot.bg.setFillStyle(0x000000, active ? 0.9 : 0.5);

            slot.swatch.setPosition(cx, y + slotSize / 2 - 8);
            slot.swatch.setAlpha(active ? 1 : 0.4);

            slot.label.setPosition(cx, y + slotSize - 18);
            slot.label.setAlpha(active ? 1 : 0.5);

            slot.keyLabel.setPosition(cx - slotSize / 2 + 4, y + 4);
        });
    }
}
