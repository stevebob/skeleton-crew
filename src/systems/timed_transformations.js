import {System} from '../engine/system.js';
import {Actions} from '../actions.js';

export class TimedTransformations extends System {
    constructor(ecsContext) {
        super(ecsContext);
        this.transformingEntities = new Set();
    }

    progress(timeDelta) {
        for (let entity of this.transformingEntities) {
            this.ecsContext.scheduleImmediateAction(
                new Actions.ProgressTransformation(entity, timeDelta)
            );
        }
    }
}
