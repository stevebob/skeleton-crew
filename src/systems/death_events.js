import {ReactiveSystem} from '../engine/reactive_system.js';
import {Actions} from '../actions.js';
import {Components} from '../components.js';

export class DeathEvents extends ReactiveSystem {
    constructor(ecsContext) {
        super(ecsContext);
        this.on(Actions.Die, (action) => {
            let entity = action.entity;
            if (entity.has(Components.Skeleton)) {
                action.success = false;
                this.ecsContext.scheduleImmediateAction(
                    new Actions.CollapseSkeleton(entity)
                );
            }
            if (entity.has(Components.Bloat)) {
                if (entity.cell !== null) {
                    this.ecsContext.scheduleImmediateAction(
                        new Actions.Explode(entity.cell.coord, 5)
                    );
                }
            }
        });
    }
}
