import {ReactiveSystem} from '../engine/reactive_system.js';
import {Actions} from '../actions.js';
import {Components} from '../components.js';

export class UpgradeOnDescent extends ReactiveSystem {
    constructor(ecsContext) {
        super(ecsContext);

        this.on(Actions.Descend, (action) => {
            action.entity.with(Components.UpgradesOnDescent, (upgrade) => {
                let level = action.stairs.get(Components.DownStairs).level;
                let depth = level.depth;
                if (depth > upgrade.maxDepth) {
                    let amount = upgrade.calculate(depth);
                    /* schedule the action on the next level's context */
                    level.ecsContext.scheduleImmediateAction(
                        new Actions.Upgrade(action.entity, depth, amount)
                    );
                }
            });
        });
    }
}
