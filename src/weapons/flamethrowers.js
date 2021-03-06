import {Weapon} from '../weapon.js';
import {Directions} from '../utils/direction.js';
import {Actions} from '../actions.js';
import {Line} from '../utils/line.js';

export class Flamethrower extends Weapon {
    constructor() {
        super();
        this.maxAmmo = 40;
        this.ammo = 0;
        this.flameSpread = 1 / 4;
        this.range = 10;
        this.lowerRange = this.range - 1;
        this.upperRange = this.range + 1;
        this.burstLength = 4;
    }

    *trajectories(line) {
        Weapon.SpreadStack.clear();
        let startCell = this.getSpreadCentre(line);

        let spreadWidth = this.flameSpread * startCell.coord.getDistance(line.startCoord);

        for (let cell of startCell.floodFill(Directions, spreadWidth)) {
            let distance = cell.coord.getDistance(line.startCoord);
            if (distance >= this.lowerRange && distance <= this.upperRange) {
                Weapon.SpreadStack.push(cell);
            }
        }
        for (let cell of Weapon.SpreadStack) {
            yield new Line(line.startCoord, cell);
        }
    }

    scheduleFlames(entity, line) {
        let delay = 0;
        for (let i = 0; i < this.burstLength; ++i) {
            for (let trajectory of this.trajectories(line)) {
                entity.ecsContext.scheduleImmediateAction(
                    new Actions.FireFlame(entity, this, trajectory),
                    delay
                );
            }
            entity.ecsContext.scheduleImmediateAction(
                new Actions.ReduceAmmo(entity, this),
                delay
            );
            delay += 10;
        }
    }
}

Flamethrower.prototype.use = async function(entity) {
    var line = await this.getLine(entity);

    if (line === null) {
        return null;
    }

    if (line.point) {
        return null;
    }

    this.scheduleFlames(entity, line);

    return new Actions.FireFlamethrower(entity, this);
}
