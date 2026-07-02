class WeaponManager {
    constructor() {
        this.weapons = {
            1: { name: 'FISTS',         key: 'melee',   auto: false, color: 0x888888, rateMs: 0,    bulletSpeed: 0    },
            2: { name: 'AR', key: 'ar',      auto: true,  color: 0xffff00, rateMs: 150,  bulletSpeed: 600  },
            3: { name: 'AWP',        key: 'sniper',  auto: false, color: 0x00ffff, rateMs: 1500, bulletSpeed: 1400 },
            4: { name: 'PUMP',       key: 'shotgun', auto: false, color: 0xff8800, rateMs: 700,  bulletSpeed: 500  },
        };
        this.current = 1;
    }

    get()       { return this.weapons[this.current]; }
    switch(num) { if (this.weapons[num]) this.current = num; }
}