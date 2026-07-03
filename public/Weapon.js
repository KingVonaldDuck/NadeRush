class Weapon {
    constructor({ name, key, auto, color, rateMs, bulletSpeed, zoom = 1 }) {
        this.name        = name;
        this.key         = key;
        this.auto        = auto;
        this.color       = color;
        this.rateMs      = rateMs;
        this.bulletSpeed = bulletSpeed;
        this.zoom        = zoom;
    }

    canFire(lastShotTime = 0) {
        return this.rateMs === 0 || Date.now() - lastShotTime >= this.rateMs;
    }
}

class Fists extends Weapon {
    constructor() {
        super({ name: 'FISTS', key: 'melee', auto: false, color: 0x888888, rateMs: 0, bulletSpeed: 0, zoom: 1 });
    }
}

class AssaultRifle extends Weapon {
    constructor() {
        super({ name: 'AR', key: 'ar', auto: true, color: 0xffff00, rateMs: 125, bulletSpeed: 2000, zoom: 1 });
    }
}

class AWP extends Weapon {
    constructor() {
        super({ name: 'AWP', key: 'sniper', auto: false, color: 0x00ffff, rateMs: 1500, bulletSpeed: 2500, zoom: 0.9 });
    }
}

class PumpShotgun extends Weapon {
    constructor() {
        super({ name: 'PUMP', key: 'shotgun', auto: true, color: 0xff8800, rateMs: 700, bulletSpeed: 2250, zoom: 1 });
    }
}