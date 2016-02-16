import {Entity} from './entity.js';

import {CellGrid, Cell} from './cell_grid.js';
import {ComponentCountingEntitySet} from './entity_set.js';

import {Config} from './config.js';
import {assert} from './assert.js';

class SpacialHashCell extends Cell {
    constructor(x, y, grid) {
        super(x, y, grid);
        this.entities = new ComponentCountingEntitySet();
    }

    has(component) {
        return this.entities.hasComponent(component);
    }

    is(component) {
        return this.entities.isComponent(component);
    }
}

class SpacialHash extends CellGrid(SpacialHashCell) {}

var instanceCount = 0;

export class EcsContext {
    constructor() {
        this.entities = new Set();
        this.width = Config.GRID_WIDTH;
        this.height = Config.GRID_HEIGHT;
        this.spacialHash = new SpacialHash(this.width, this.height);
        this.id = instanceCount;
        ++instanceCount;
    }

    emplaceEntity(components = []) {
        let entity = new Entity(components);
        this.addEntity(entity);
        return entity;
    }

    addEntity(entity) {
        assert(entity.ecsContext === null);
        this.entities.add(entity);
        entity.onAdd(this);
    }

    removeEntity(entity) {
        assert(entity.ecsContext === this);
        this.entities.delete(entity);
        entity.onRemove(this);
    }
}