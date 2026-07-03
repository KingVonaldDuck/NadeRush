class WeaponManager {
    constructor() {
        this.weapons = {
            1: new Fists(),
            2: new AssaultRifle(),
            3: new AWP(),
            4: new PumpShotgun(),
        };
        this.current = 1;
    }

    get()         { return this.weapons[this.current]; }
    getByKey(key) { return Object.values(this.weapons).find(w => w.key === key); }
    switch(num)   { if (this.weapons[num]) this.current = num; }
}