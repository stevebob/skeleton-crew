import {Config} from '../config.js';

import {Components} from '../components.js';
import {Tiles} from '../tiles.js';

import * as Shadowcast from '../shadowcast.js';
import * as Omniscient from '../omniscient.js';

import {PlayerTurnTaker} from '../player_control.js';
import {MoveTowardsPlayer} from '../move_towards_player.js';

import {makeEnum} from '../utils/enum.js';

export const CombatGroups = makeEnum([
    'Friendly',
    'Hostile'
]);

export function PlayerCharacter(x, y) {
    let observe;
    if (Config.OMNISCIENT) {
        observe = Omniscient.detectVisibleArea;
    } else {
        observe = Shadowcast.detectVisibleArea;
    }

    let computeUpgrade = (depth) => {
        return depth * 10;
    }

    return [
        new Components.Position(x, y),
        new Components.Tile(Tiles.PlayerCharacter, 4),
        new Components.TurnTaker(new PlayerTurnTaker()),
        new Components.Collider(),
        new Components.PlayerCharacter(),
        new Components.Observer(observe, 15),
        new Components.Health(20),
        new Components.MaxHealth(20),
        new Components.Oxygen(20),
        new Components.MaxOxygen(20),
        new Components.Breathing(1),
        new Components.Combatant(CombatGroups.Friendly),
        new Components.Attack(2),
        new Components.Defense(1),
        new Components.Accuracy(80),
        new Components.Dodge(1),
        new Components.Unfamiliar(),
        new Components.WeaponInventory(),
        new Components.Knockable(),
        new Components.Ventable(),
        new Components.AutoPickup(),
        new Components.AutoClimb(),
        new Components.Name("You"),
        new Components.Description("You. You awoke from cryosleep in deep space. The ship's computer told you that the rest of the crew is dead.")
    ];
}

function GenericCharacter(x, y, tile, health, walkTime, burnTime = 5, fleeHealth = 0.5, healthRecovery = 0.1) {
    let components = [
        new Components.Position(x, y),
        new Components.Tile(tile, 4),
        new Components.Collider(),
        new Components.Observer(Shadowcast.detectVisibleArea, 20, true /* familiar */),
        new Components.Health(health),
        new Components.MaxHealth(health),
        new Components.Combatant(CombatGroups.Hostile),
        new Components.Unfamiliar(),
        new Components.Flamable(burnTime),
        new Components.HealthRecovery(healthRecovery),
        new Components.Knockable(),
        new Components.Ventable(),
        new Components.WalkTime(walkTime)
    ];
    if (Config.AI) {
        components.push(new Components.TurnTaker(new MoveTowardsPlayer(fleeHealth)));
    }
    return components;
}

export function Zombie(x, y) {
    return GenericCharacter(x, y, Tiles.Zombie, 20, 1.5, 100, 0.5).concat([
        new Components.Attack(2),
        new Components.Defense(1),
        new Components.Accuracy(100),
        new Components.Dodge(2),
        new Components.Name("Zombie"),
        new Components.Description("A zombie. A former member of your crew. You recognize its face.")
    ]);
}

export function Skeleton(x, y) {
    return GenericCharacter(x, y, Tiles.Skeleton, 10, 0.5, 2, 0.25).concat([
        new Components.Attack(1),
        new Components.Defense(1),
        new Components.Accuracy(80),
        new Components.Dodge(20),
        new Components.Name("Skeleton"),
        new Components.Description("A Skeleton. The flesh has fallen from its bones, and yet it moves."),
        new Components.Skeleton()
    ]);
}

export function Bloat(x, y) {
    return GenericCharacter(x, y, Tiles.Bloat, 5, 2, 100, 0).concat([
        new Components.Attack(1),
        new Components.Defense(1),
        new Components.Accuracy(80),
        new Components.Dodge(20),
        new Components.Name("Bloat"),
        new Components.Description("A Bloat. This corpse appears inflated, as if by some sort of gas."),
        new Components.Bloat()
    ]);
}
