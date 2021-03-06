import {System} from '../engine/system.js';

import {Components} from '../components.js';

export class Observation extends System {
    constructor(ecsContext) {
        super(ecsContext);
    }

    run(entity) {
        entity.with(Components.Observer, (observer) => {
            let knowledgeGrid = observer.knowledge.getGrid(this.ecsContext);

            let grid = this.ecsContext.spacialHash;
            let eyePosition = entity.get(Components.Position).vector;
            let viewDistance = observer.viewDistance;

            for (let cell of observer.observe(eyePosition, viewDistance, grid)) {
                let knowledgeCell = knowledgeGrid.get(cell.coord);
                if (knowledgeCell.dirty) {
                    knowledgeCell.clear();
                    for (let e of cell.entities.set) {
                        knowledgeCell.see(e);
                    }
                } else {
                    knowledgeCell.turn = this.ecsContext.turn;
                }
            }
        });
    }
}
