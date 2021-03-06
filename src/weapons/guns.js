import {Actions} from '../actions.js';

import {Directions} from '../utils/direction.js';
import {getRandomInt} from '../utils/random.js';
import {Line} from '../utils/line.js';
import {makeEnum} from '../utils/enum.js';

import {Weapon} from '../weapon.js';


export const AmmoReductionType = makeEnum([
    'PerShot',
    'PerBurst'
]);

export class Gun extends Weapon {

    constructor() {
        super();
        this.ammo = 0;
        this.range = 30;
        this.FireActionType = Actions.FireBullet;
    }

    *trajectories(line) {
        Weapon.SpreadStack.clear();
        let startCell = this.getSpreadCentre(line);
        let spreadWidth = this.bulletSpread * startCell.coord.getDistance(line.startCoord);
        for (let cell of startCell.floodFill(Directions, spreadWidth)) {
            Weapon.SpreadStack.push(cell);
        }
        for (let i = 0; i < this.burstSize; ++i) {
            let endCoord = Weapon.SpreadStack.array[getRandomInt(0, Weapon.SpreadStack.length)];
            yield endCoord;
        }
    }

    scheduleBullets(entity, line) {
        let delay = 0;
        for (let destination of this.trajectories(line)) {
            entity.ecsContext.scheduleImmediateAction(
                new this.FireActionType(entity, this, destination),
                delay
            );
            if (this.ammoReduction === AmmoReductionType.PerShot) {
                entity.ecsContext.scheduleImmediateAction(
                    new Actions.ReduceAmmo(entity, this),
                    delay
                );
            }
            delay += this.timeBetweenShot;
        }
        if (this.ammoReduction === AmmoReductionType.PerBurst) {
            entity.ecsContext.scheduleImmediateAction(
                new Actions.ReduceAmmo(entity, this),
                delay - this.timeBetweenShot
            );
        }
    }
}

Gun.prototype.use = async function(entity) {
    var line = await this.getLine(entity);

    if (line === null) {
        return null;
    }

    if (line.point) {
        return null;
    }

    this.scheduleBullets(entity, line);

    return new Actions.FireGun(entity, this);
}

export class Pistol extends Gun {
    constructor() {
        super();
        this.maxAmmo = 100;
        this.bulletSpread = 1 / 16;
        this.burstSize = 1;
        this.timeBetweenShot = 0;
        this.ammoReduction = AmmoReductionType.PerShot;
    }
}

export class Shotgun extends Gun {
    constructor() {
        super();
        this.maxAmmo = 50;
        this.bulletSpread = 1 / 3;
        this.burstSize = 6;
        this.timeBetweenShot = 0;
        this.ammoReduction = AmmoReductionType.PerBurst;
    }
}

export class MachineGun extends Gun {
    constructor() {
        super();
        this.maxAmmo = 200;
        this.bulletSpread = 1 / 5;
        this.burstSize = 6;
        this.timeBetweenShot = 20;
        this.ammoReduction = AmmoReductionType.PerShot;
    }
}

