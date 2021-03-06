import {ReactiveSystem} from '../engine/reactive_system.js';
import {Actions} from '../actions.js';
import {Components} from '../components.js';
import {CellGrid, Cell} from '../utils/cell_grid.js';
import {Stack} from '../utils/stack.js';
import {DijkstraMap, DijkstraCell} from '../utils/dijkstra_map.js';
import {BestSet} from '../utils/best_set.js';
import {Directions} from '../utils/direction.js';
import {roll} from '../utils/dice.js';

const VacuumCellStack = new Stack();
const VacuumCoordStack = new Stack();

class AtmosphereCell extends Cell {
    constructor(x, y, grid) {
        super(x, y, grid);
        this.spacialHashCell = null;
        this.atmosphere = 0;
        this.ventRate = 0.1;
        this.facingVacuum = false;
        this.facingAtmosphere = false;
        this.venting = false;
        this.vacuumDistance = -1;
        this.direction = null;
    }

    get solid() {
        return this.spacialHashCell.is(Components.Solid);
    }

    get pressureWall() {
        return this.facingVacuum && this.facingAtmosphere;
    }

    floodFillCompare(cell) {
        let ret = this.spacialHashCell.is(Components.Solid) -
               cell.spacialHashCell.is(Components.Solid);
        return ret;
    }

    getLowestNeighbours() {
        let best = this.grid.bestNeighbour;
        best.clear();
        for (let direction of Directions) {
            let neighbour = this.getNeighbour(direction);
            neighbour.direction = direction;
            best.insert(neighbour);
        }
        return best;
    }
}

function compareMoveCost(a, b) {
    if (a.atmosphere === 0 && b.atmosphere === 0) {
        return 0;
    }
    if (a.atmosphere === 0) {
        return 1;
    }
    if (b.atmosphere === 0) {
        return -1;
    }
    if (a.venting && b.venting) {
        return b.vacuumDistance - a.vacuumDistance;
    }
    if (a.venting) {
        return 1;
    }
    if (b.venting) {
        return -1;
    }
    return 0;
}

class AtmosphereGrid extends CellGrid(AtmosphereCell) {
    constructor(width, height) {
        super(width, height);
        this.bestNeighbour = new BestSet(compareMoveCost, 8); // 8 directions
    }
}

class FrontierCell extends DijkstraCell {
    constructor(x, y, grid) {
        super(x, y, grid);
        this.spacialHashCell = null;
        this.atmosphereCell = null;
        this._visited = false;
    }

    get visited() {
        return this._visited;
    }

    set visited(value) {
        this._visited = value;
        if (value && this.value !== 0) {
            this.grid.frontier.push(this.coord);
        }
    }

    isEnterable(fromCell) {
        return !fromCell.atmosphereCell.solid;
    }
}

class FrontierMap extends DijkstraMap(FrontierCell) {
    constructor(width, height) {
        super(width, height);
        this.frontier = new Stack();
    }

    clear() {
        super.clear();
        this.frontier.clear();
    }
}

class VentCell extends DijkstraCell {
    constructor(x, y, grid) {
        super(x, y, grid);
        this.spacialHashCell = null;
        this.atmosphereCell = null;
    }
    isEnterable(fromCell) {
        return !this.atmosphereCell.solid;
    }
}

class VentMap extends DijkstraMap(VentCell) {}

export class Atmosphere extends ReactiveSystem {
    constructor(ecsContext) {
        super(ecsContext);
        this.grid = new AtmosphereGrid(this.width, this.height);
        this.frontierMap = new FrontierMap(this.width, this.height);
        this.ventMap = new VentMap(this.width, this.height);
        this.ventableEntities = new Set();
        this.breathingEntities = new Set();

        for (let cell of this.spacialHash) {
            let atmosphereCell = this.grid.get(cell.coord);
            let frontierCell = this.frontierMap.get(cell.coord);
            let ventCell = this.ventMap.get(cell.coord);
            atmosphereCell.spacialHashCell = cell;
            frontierCell.spacialHashCell = cell;
            frontierCell.atmosphereCell = atmosphereCell;
            ventCell.spacialHashCell = cell;
            ventCell.atmosphereCell = atmosphereCell;
        }

        this.on(Actions.ProjectileCollide, (action) => {
            if (action.entity.is(Components.Bullet) &&
                action.contact.is(Components.Breakable) &&
                this.grid.get(action.contact.cell.coord).pressureWall) {
                if (roll(3) === 1) {
                    this.ecsContext.scheduleImmediateAction(
                        new Actions.Destroy(action.contact)
                    );
                }
            }

            if (action.entity.is(Components.ShockWave) &&
                action.contact.is(Components.Breakable)) {
                if (roll(3) > 1) {
                    this.ecsContext.scheduleImmediateAction(
                        new Actions.Destroy(action.contact)
                    );
                }
            }

        });

        this.on(Actions.Destroy, (action) => {
            if (action.entity.ecsContext !== null) {
                    this.ecsContext.scheduleImmediateAction(
                        new Actions.OpenBreach(),
                        100
                    );
            }
        });

        this.on(Actions.OpenDoor, (action) => {
            let breached = this.grid.get(action.door.cell.coord).pressureWall;
            this.ecsContext.scheduleImmediateAction(
                new Actions.OpenBreach()
            );
        });

        this.on(Actions.CloseDoor, (action) => {
            this.ecsContext.scheduleImmediateAction(
                new Actions.CloseBreach()
            );
        });

        this.on(Actions.FireFlame, (action) => {
            if (this.grid.get(action.entity.cell.coord).atmosphere === 0) {
                if (action.weapon.ammo > 0) {
                    action.success = false;
                    this.ecsContext.scheduleImmediateAction(
                        new Actions.SprayFlamethrowerFuel(action.entity, action.weapon)
                    );
                }
            }
        });
    }

    add(entity) {
        this.ventableEntities.add(entity);
    }

    remove(entity) {
        this.ventableEntities.delete(entity);
    }

    updateVenting() {
        VacuumCoordStack.clear();
        for (let cell of this.grid) {
            if (cell.atmosphere === 0) {
                VacuumCoordStack.push(cell.coord);
            }
        }
        this.ventMap.clear();
        this.ventMap.computeFromZeroCoords(VacuumCoordStack);
        for (let ventCell of this.ventMap) {
            if (ventCell.visited && ventCell.value !== 0) {
                let cell = this.grid.get(ventCell.coord);
                cell.venting = true;
                cell.vacuumDistance = ventCell.value;
            }
        }
        this.refreshWalls();
    }

    refresh() {
        this.refreshVacuumCells();
        this.refreshWalls();
    }

    refreshWalls() {
        this.refreshVacuumFacingWalls();
        this.refreshAtmosphereFacingWalls();
    }

    refreshVacuumFacingWalls() {
        VacuumCoordStack.clear();
        for (let cell of this.grid) {
            cell.facingVacuum = false;
            if (cell.atmosphere !== 1) {
                VacuumCoordStack.push(cell.coord);
            }
        }
        this.frontierMap.frontier.clear();
        this.frontierMap.computeFromZeroCoords(VacuumCoordStack);
        for (let coord of this.frontierMap.frontier) {
            this.grid.get(coord).facingVacuum = true;
        }
    }

    refreshAtmosphereFacingWalls() {
        VacuumCoordStack.clear();
        for (let cell of this.grid) {
            cell.facingAtmosphere = false;
            if (cell.atmosphere === 1 && !cell.solid && !cell.venting) {
                VacuumCoordStack.push(cell.coord);
            }
        }
        this.frontierMap.frontier.clear();
        this.frontierMap.computeFromZeroCoords(VacuumCoordStack);
        for (let coord of this.frontierMap.frontier) {
            this.grid.get(coord).facingAtmosphere = true;
        }
    }

    refreshVacuumCells() {
        for (let region of this.grid.floodFill()) {

            VacuumCellStack.clear();
            let vacuum = false;

            for (let cell of region) {
                if (cell.spacialHashCell.is(Components.Void)) {
                    vacuum = true;
                }
                VacuumCellStack.push(cell);
            }

            if (!vacuum) {
                for (let cell of VacuumCellStack) {
                    cell.atmosphere = 1;
                    cell.venting = false;
                }
            }
        }
    }

    suckEntities(timeDelta) {
        if (timeDelta === 0) {
            return;
        }
        let whole = Math.ceil(timeDelta);
        for (let entity of this.ventableEntities) {
            if (entity.has(Components.Position)) {
                let cell = this.grid.get(entity.cell.coord);
                if (cell.venting) {
                    for (let i = 0; i < whole; ++i) {
                        let n = 2;
                        /* The player is harder to suck out than NPCs and items */
                        if (entity.is(Components.PlayerCharacter)) {
                            n = 4;
                        }
                        if (roll(n) === 1) {
                            let dest = cell.getLowestNeighbours().getRandom();
                            this.ecsContext.scheduleImmediateAction(
                                new Actions.Vent(entity, dest.direction)
                            );
                        }
                    }
                }
            }
        }
    }

    processBreathers(timeDelta) {
        for (let entity of this.breathingEntities) {
            let cell = this.grid.get(entity.cell.coord);
            if (cell.atmosphere === 0) {
                if (entity.get(Components.Oxygen).value > 0) {
                    this.ecsContext.scheduleImmediateAction(
                        new Actions.ConsumeOxygen(entity, timeDelta * entity.get(Components.Breathing).rate)
                    );
                } else {
                    this.ecsContext.scheduleImmediateAction(
                        new Actions.TakeDamage(entity, timeDelta * entity.get(Components.Breathing).rate)
                    );
                }
            } else if (cell.atmosphere === 1) {
                this.ecsContext.scheduleImmediateAction(
                    new Actions.ReplenishOxygen(entity, timeDelta * entity.get(Components.Breathing).rate)
                );
            }
        }
    }

    processBurning(timeDelta) {
        for (let entity of this.ecsContext.fire.entities) {
            if (this.grid.get(entity.cell.coord).atmosphere === 0) {
                this.ecsContext.scheduleImmediateAction(
                    new Actions.Extinguish(entity)
                );
            }
        }
    }

    progress(timeDelta) {

        this.suckEntities(timeDelta);
        this.processBreathers(timeDelta);
        this.processBurning(timeDelta);

        /* Reduce the atmosphere of venting cells */
        for (let i = 0; i < this.grid.size; ++i) {
            let cell = this.grid.array[i];
            if (cell.venting) {
                cell.atmosphere = Math.max(0, cell.atmosphere - cell.ventRate * timeDelta);
                if (cell.atmosphere === 0) {
                    cell.venting = false;
                }
            }
        }
    }
}
