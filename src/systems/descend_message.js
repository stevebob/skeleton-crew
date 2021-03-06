import {ReactiveSystem} from '../engine/reactive_system.js';
import {Actions} from '../actions.js';
import {Components} from '../components.js';

export class DescendMessage extends ReactiveSystem {
    constructor(ecsContext) {
        super(ecsContext);

        this.on(Actions.Descend, (action) => {
            if (!action.force && action.stairs.get(Components.DownStairs).upStairs === null) {
                this.ecsContext.hud.overlay = "Climbing down the stairs...";
                this.ecsContext.hud.showOverlay();
                action.success = false;
                /* Schedule a copy of the action to run after the message is displayed */
                this.ecsContext.scheduleImmediateAction(
                    new Actions.Descend(action.entity, action.stairs, true /* force */),
                    100
                );
            }
        });
    }
}
