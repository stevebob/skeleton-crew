import {Action} from '../engine/action.js';
import {Components} from '../components.js';
import {EntityPrototypes} from '../entity_prototypes.js';
import {roll} from '../utils/dice.js';
import {AmmoReductionType} from '../weapons/guns.js';
import {Line} from '../utils/line.js';
import {Directions} from '../utils/direction.js';
import {Stack} from '../utils/stack.js';

export class Walk extends Action {
    constructor(entity, direction) {
        super();
        this.entity = entity;
        this.direction = direction;
        this.position = this.entity.get(Components.Position);
        this.source = this.position.vector;
        this.destination = this.source.add(this.direction.vector);
    }

    commit() {
        this.position.vector = this.destination;
    }
}

export class Vent extends Action {
    constructor(entity, direction) {
        super();
        this.entity = entity;
        this.direction = direction;
        this.position = this.entity.get(Components.Position);
        this.source = this.position.vector;
        this.destination = this.source.add(this.direction.vector);
    }

    commit() {
        if (this.position.entity !== null) {
            this.position.vector = this.destination;
        }
    }
}


export class Knockback extends Action {
    constructor(entity, destination) {
        super();
        this.entity = entity;
        this.position = this.entity.get(Components.Position);
        this.source = this.position.vector;
        this.destination = destination;
    }

    commit() {
        this.position.vector = this.destination;
    }
}

export class Wait extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit() {

    }
}

export class OpenDoor extends Action {
    constructor(entity, door) {
        super();
        this.entity = entity;
        this.door = door;
    }

    commit() {
        this.door.with(Components.Door, (door) => {
            door.open = true;
        });
    }
}

export class CloseDoor extends Action {
    constructor(entity, door) {
        super();
        this.entity = entity;
        this.door = door;
    }

    commit() {
        this.door.with(Components.Door, (door) => {
            door.open = false;
        });
    }
}

export class FireFlamethrower extends Action {
    constructor(entity, weapon) {
        super();
        this.entity = entity;
        this.weapon = weapon;
    }
    commit(ecsContext) {

    }
}

export class FireFlame extends Action {
    constructor(entity, weapon, trajectory) {
        super();
        this.entity = entity;
        this.weapon = weapon;
        this.trajectory = trajectory;
    }

    commit(ecsContext) {
        if (this.weapon.ammo > 0) {
            let projectile = this.entity.ecsContext.emplaceEntity(
                EntityPrototypes.Fireball(this.trajectory.startCoord.x, this.trajectory.startCoord.y)
            );
            ecsContext.scheduleImmediateAction(
                new FireProjectile(this.entity, projectile, this.trajectory)
            );
        } else {
            ecsContext.scheduleImmediateAction(
                new FailFire(this.entity, this.weapon)
            );
        }
    }
}

export class SprayFlamethrowerFuel extends Action {
    constructor(entity, weapon) {
        super();
        this.entity = entity;
        this.weapon = weapon;
    }

    commit(ecsContext) {
        ecsContext.hud.message = "You spray some fuel which fails to ignite.";
    }
}

/* As guns can fire a bust of bullets in a single turn, there
 * needs to be a separation between the action of firing the gun
 * and the start of the bullets on their path.
 */
export class FireGun extends Action {
    constructor(entity, weapon) {
        super();
        this.entity = entity;
        this.weapon = weapon;
    }
    commit(ecsContext) {

    }
}

/* A wrapper around FireProjectile and ReduceAmmo */
export class FireBullet extends Action {
    constructor(entity, weapon, destination) {
        super();
        this.entity = entity;
        this.weapon = weapon;
        this.destination = destination;
    }

    commit(ecsContext) {
        let trajectory = new Line(this.entity.cell.coord, this.destination);
        if (this.weapon.ammo > 0) {
            let projectile = this.entity.ecsContext.emplaceEntity(
                EntityPrototypes.Bullet(trajectory.startCoord.x, trajectory.startCoord.y)
            );
            ecsContext.scheduleImmediateAction(
                new FireProjectile(this.entity, projectile, trajectory, false /* infinite */)
            );
        } else {
            ecsContext.scheduleImmediateAction(
                new FailFire(this.entity, this.weapon)
            );
        }
    }
}

export class FireRocket extends Action {
    constructor(entity, weapon, destination) {
        super();
        this.entity = entity;
        this.weapon = weapon;
        this.destination = destination;
    }

    commit(ecsContext) {
        let trajectory = new Line(this.entity.cell.coord, this.destination);
        if (this.weapon.ammo > 0) {
            let projectile = this.entity.ecsContext.emplaceEntity(
                EntityPrototypes.Rocket(trajectory.startCoord.x, trajectory.startCoord.y)
            );
            ecsContext.scheduleImmediateAction(
                new FireProjectile(this.entity, projectile, trajectory, false /* infinite */)
            );
        } else {
            ecsContext.scheduleImmediateAction(
                new FailFire(this.entity, this.weapon)
            );
        }
    }
}

export class ReduceAmmo extends Action {
    constructor(entity, weapon) {
        super();
        this.entity = entity;
        this.weapon = weapon;
    }

    commit(ecsContext) {
        this.weapon.ammo = Math.max(this.weapon.ammo - 1, 0);
    }
}

export class FailFire extends Action {
    constructor(entity, weapon) {
        super();
        this.entity = entity;
        this.weapon = weapon;
    }

    commit(ecsContext) {
        ecsContext.hud.message = "&lt;click&gt;";
    }
}

export class FireProjectile extends Action {
    constructor(entity, projectile, trajectory, infinite = false) {
        super();
        this.entity = entity;
        this.projectile = projectile;
        if (infinite) {
            this.trajectory = trajectory.infiniteAbsoluteCoords();
        } else {
            this.trajectory = trajectory.absoluteCoords();
        }
    }

    commit(ecsContext) {
        let next = this.trajectory.next();
        if (next.done) {
            ecsContext.scheduleImmediateAction(
                new ProjectileTerminate(this.projectile)
            );
        } else {
            ecsContext.scheduleImmediateAction(
                new ProjectileStep(this.projectile, this.trajectory, next.value)
            );
        }
    }
}

export class ProjectileStep extends Action {
    constructor(entity, trajectory, destination) {
        super();
        this.entity = entity;
        this.trajectory = trajectory;
        this.destination = destination;
    }

    commit(ecsContext) {
        this.entity.get(Components.Position).vector = this.destination;
        let next = this.trajectory.next();
        if (next.done) {
            ecsContext.scheduleImmediateAction(
                new ProjectileTerminate(this.entity),
                10
            );
        } else {
            ecsContext.scheduleImmediateAction(
                new ProjectileStep(this.entity, this.trajectory, next.value),
                10
            );
        }
    }
}

export class ProjectileTerminate extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit(ecsContext) {
        ecsContext.removeEntity(this.entity);
    }
}

export class ProjectileCollide extends Action {
    constructor(entity, contact, trajectory) {
        super();
        this.entity = entity;
        this.contact = contact;
        this.trajectory = trajectory;
    }

    commit(ecsContext) {
        ecsContext.removeEntity(this.entity);
    }
}

export class MeleeAttack extends Action {
    constructor(attacker, target) {
        super();
        this.attacker = attacker;
        this.target = target;
    }

    commit(ecsContext) {}
}

export class MeleeAttackHit extends Action {
    constructor(attacker, target, damage) {
        super();
        this.attacker = attacker;
        this.target = target;
        this.damage = damage;
    }

    commit(ecsContext) {
        ecsContext.scheduleImmediateAction(
            new TakeDamage(this.target, this.damage)
        );
    }
}

export class TakeDamage extends Action {
    constructor(entity, damage) {
        super();
        this.entity = entity;
        this.damage = damage;
    }

    commit(ecsContext) {
        this.entity.with(Components.Health, (health) => {
            health.value -= this.damage;
            if (health.value <= 0) {
                ecsContext.scheduleImmediateAction(
                    new Die(this.entity)
                );
            }
        });
    }
}

export class Die extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit(ecsContext) {
        this.entity.with(Components.TurnTaker, (turnTaker) => {
            turnTaker.nextTurn.enabled = false;
        });
        ecsContext.removeEntity(this.entity);
    }
}

export class CatchFire extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit(ecsContext) {
        this.entity.with(Components.Flamable, (flamable) => {
            if (this.entity.has(Components.Burning)) {
                this.entity.get(Components.Burning).time = flamable.time;
            } else {
                this.entity.add(new Components.Burning(flamable.time));
            }
        });
    }
}

export class Burn extends Action {
    constructor(entity, time) {
        super();
        this.entity = entity;
        this.time = time;
    }

    commit(ecsContext) {
        this.entity.with(Components.Burning, (burning) => {

            /* Spread the fire to adjacent cells */
            let nextBurningTime = burning.time - this.time;
            let difference = Math.floor(burning.time) - Math.floor(nextBurningTime);
            for (let i = 0; i < difference; ++i) {
                for (let neighbour of this.entity.cell.neighbours) {
                    neighbour.withEntity(Components.Flamable, (entity) => {
                        if (!entity.is(Components.Burning) && roll(20) === 1) {
                            ecsContext.scheduleImmediateAction(
                                new CatchFire(entity)
                            );
                        }
                    });
                    neighbour.withEntity(Components.Meltable, (entity) => {
                        if (roll(6) <= 2) {
                            ecsContext.scheduleImmediateAction(
                                new Melt(entity)
                            );
                        }
                    });
                }
            }

            if (!burning.infinite) {
                burning.time = nextBurningTime;
            }

            /* Damage burning characters */
            if (this.entity.has(Components.Health) && !this.entity.has(Components.Fireproof)) {
                ecsContext.scheduleImmediateAction(
                    new TakeDamage(this.entity, this.time)
                );
            }

            /* Resolve burning running out */
            if (burning.time <= 0) {
                if (this.entity.has(Components.Health)) {
                    this.entity.remove(Components.Burning);
                } else {
                    ecsContext.removeEntity(this.entity);
                }
            }
        });
    }
}

export class Descend extends Action {
    constructor(entity, stairs, force = false) {
        super();
        this.entity = entity;
        this.stairs = stairs;

        /* A system traps Descends if they will cause the generator
         * to run and prints a loading message. This tells the system
         * to ignore Descends even if they will cause the generator
         * to run. */
        this.force = force;
    }

    commit(ecsContext) {
        /* Find the level down the stairs */
        let nextLevel = this.stairs.get(Components.DownStairs).level;

        /* Make sure the level has been generated before proceeding */
        nextLevel.generate();

        /* Remove the entity from its ecs context, and add it to the
         * new level's ecs context */
        ecsContext.removeEntity(this.entity);
        nextLevel.ecsContext.addEntity(this.entity);

        /* Move the entity to be located at the corresponding upwards
         * staircase */
        let upStairs = this.stairs.get(Components.DownStairs).upStairs;
        let position = this.entity.get(Components.Position);
        position.vector = upStairs.get(Components.Position).vector;

        /* Clear any loading message printed as the level was generated */
        ecsContext.hud.hideOverlay();
    }
}

export class Ascend extends Action {
    constructor(entity, stairs) {
        super();
        this.entity = entity;
        this.stairs = stairs;
    }

    commit(ecsContext) {
        /* Find the level up the stairs */
        let nextLevel = this.stairs.get(Components.UpStairs).level;

        /* Make sure the level has been generated before proceeding */
        nextLevel.generate();

        /* Remove the entity from its ecs context, and add it to the
         * new level's ecs context */
        ecsContext.removeEntity(this.entity);
        nextLevel.ecsContext.addEntity(this.entity);

        /* Move the entity to be located at the corresponding upwards
         * staircase */
        let downStairs = this.stairs.get(Components.UpStairs).downStairs;
        let position = this.entity.get(Components.Position);
        position.vector = downStairs.get(Components.Position).vector;
    }
}

export class Melt extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit() {
        let position = this.entity.get(Components.Position);
        this.entity.become(EntityPrototypes.Water(position.vector));
    }
}

export class Extinguish extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }
    commit() {
        this.entity.remove(Components.Burning);
    }
}

export class Upgrade extends Action {
    constructor(entity, depth, amount) {
        super();
        this.entity = entity;
        this.amount = amount;
        this.depth = depth;
    }
    commit() {
        this.entity.get(Components.Health).value += this.amount;
        this.entity.get(Components.UpgradesOnDescent).maxDepth = this.depth;
    }
}

export class GetShot extends Action {
    constructor(entity, bullet, trajectory) {
        super();
        this.entity = entity;
        this.bullet = bullet;
        this.trajectory = trajectory;
    }

    commit(ecsContext) {
        ecsContext.scheduleImmediateAction(
            new TakeDamage(this.entity, 3 + roll(3))
        );
        if (this.entity.is(Components.Knockable) && roll(4) == 1) {
            let next = this.trajectory.next();
            if (!next.done) {
                ecsContext.scheduleImmediateAction(
                    new Knockback(this.entity, next.value)
                );
            }
        }
    }
}

export class ShockWaveHit extends Action {
    constructor(entity, shockWave, trajectory) {
        super();
        this.entity = entity;
        this.shockWave = shockWave;
        this.trajectory = trajectory;
    }

    commit(ecsContext) {
        ecsContext.scheduleImmediateAction(
            new TakeDamage(this.entity, 1 + roll(6))
        );
        if (this.entity.is(Components.Knockable) && roll(2) == 1) {
            let next = this.trajectory.next();
            if (!next.done) {
                ecsContext.scheduleImmediateAction(
                    new Knockback(this.entity, next.value)
                );
            }
        }
    }
}

export class RocketHit extends Action {
    constructor(entity, rocket, trajectory) {
        super();
        this.entity = entity;
        this.rocket = rocket;
        this.trajectory = trajectory;
    }

    commit(ecsContext) {
        ecsContext.scheduleImmediateAction(
            new TakeDamage(this.entity, 4 + roll(6))
        );
        if (this.entity.is(Components.Knockable)) {
            let next = this.trajectory.next();
            if (!next.done) {
                ecsContext.scheduleImmediateAction(
                    new Knockback(this.entity, next.value)
                );
            }
        }
    }
}

export class Get extends Action {
    constructor(entity, item) {
        super();
        this.entity = entity;
        this.item = item;
    }

    commit(ecsContext) {
        if (this.item.is(Components.Weapon)) {
            let originalAmmo = this.item.get(Components.Weapon).weapon.ammo;
            let alreadyPresent = this.entity.get(Components.WeaponInventory).addWeapon(this.item);
            if (alreadyPresent) {
                /* Remove the weapon if we just emptied it */
                this.item.with(Components.Weapon, (weaponComponent) => {
                    if (weaponComponent.weapon.ammo === 0) {
                        ecsContext.removeEntity(this.item);
                    }
                });
                let newAmmo = this.item.get(Components.Weapon).weapon.ammo;
                if (originalAmmo !== newAmmo) {
                    ecsContext.hud.message = `You unload the ${this.item.get(Components.Name).simpleValue}`
                }
            } else {
                /* Pick up the item */
                this.item.remove(Components.Position);
                ecsContext.hud.message = `You take the ${this.item.get(Components.Name).simpleValue}`
            }
        } else if (this.item.is(Components.HealthKit)) {
            let health = this.entity.get(Components.Health);
            let maxHealth = this.entity.get(Components.MaxHealth);
            if (health.value < maxHealth.value) {
                health.value = Math.min(health.value + this.item.get(Components.HealthKit).value, maxHealth.value);
                ecsContext.hud.message = "You use the health kit";
                ecsContext.removeEntity(this.item);
            }
        }
    }
}

export class NextWeapon extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit() {
        this.entity.with(Components.WeaponInventory, (inventory) => {
            inventory.switchForwards();
        });
    }
}

export class PreviousWeapon extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit() {
        this.entity.with(Components.WeaponInventory, (inventory) => {
            inventory.switchBackwards();
        });
    }
}

export class SpecificWeapon extends Action {
    constructor(entity, slot) {
        super();
        this.entity = entity;
        this.slot = slot;
    }

    commit() {
        this.entity.with(Components.WeaponInventory, (inventory) => {
            inventory.switchSpecific(this.slot);
        });
    }
}

export class Destroy extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit(ecsContext) {
        ecsContext.removeEntity(this.entity);
    }
}

export class OpenBreach extends Action {
    constructor(breached = true) {
        super();
        this.breached = breached;
    }

    commit(ecsContext) {
        ecsContext.atmosphere.updateVenting();
        if (this.breached) {
            ecsContext.atmosphere.suckEntities(1);
        }
    }
}

export class CloseBreach extends Action {
    commit(ecsContext) {
        ecsContext.atmosphere.refresh();
    }
}

export class FallIntoSpace extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit(ecsContext) {
        if (this.entity.is(Components.PlayerCharacter)) {
            this.entity.add(new Components.StuckInSpace());
        } else {
            ecsContext.removeEntity(this.entity);
        }
    }
}

export class ConsumeOxygen extends Action {
    constructor(entity, amount) {
        super();
        this.entity = entity;
        this.amount = amount;
    }

    commit(ecsContext) {
        this.entity.with(Components.Oxygen, (oxygen) => {
            oxygen.value = Math.max(oxygen.value - this.amount, 0);
        });
    }
}

export class ReplenishOxygen extends Action {
    constructor(entity, amount) {
        super();
        this.entity = entity;
        this.amount = amount;
    }

    commit(ecsContext) {
        let maxOxygen = this.entity.get(Components.MaxOxygen).value;
        this.entity.with(Components.Oxygen, (oxygen) => {
            oxygen.value = Math.min(oxygen.value + this.amount, maxOxygen);
        });
    }
}

export class CollapseSkeleton extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit(ecsContext) {
        if (this.entity.cell !== null) {
            this.entity.become(EntityPrototypes.PileOfBones(this.entity.cell.coord));
        }
    }
}

export class ProgressTransformation extends Action {
    constructor(entity, time) {
        super();
        this.entity = entity;
        this.time = time;
    }

    commit(ecsContext) {
        let transformation = this.entity.get(Components.TimedTransformation);
        transformation.time = Math.max(transformation.time - this.time, 0);
        if (transformation.time === 0) {
            this.entity.become(transformation.entityPrototype(this.entity.cell.coord));
        }
    }
}

export class Explode extends Action {
    constructor(position, radius) {
        super();
        this.position = position;
        this.radius = radius;
    }

    commit(ecsContext) {
        let centreCell = ecsContext.spacialHash.get(this.position);
        let targets = Explode.CellStack;
        targets.clear();
        for (let cell of centreCell.floodFill(Directions, this.radius)) {
            if (cell.coord.getDistance(centreCell.coord) >= this.radius - 1 ||
                cell.isBorder()) {
                targets.push(cell);
            }
        }
        for (let target of targets) {
            let shockWave = ecsContext.emplaceEntity(
                EntityPrototypes.ShockWave(centreCell.x, centreCell.y)
            );
            let trajectory = new Line(centreCell.coord, target.coord);
            ecsContext.scheduleImmediateAction(
                new FireProjectile(null, shockWave, trajectory)
            );
        }
    }
}
Explode.CellStack = new Stack();

export class Win extends Action {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    commit(ecsContext) {
        this.entity.add(new Components.Won());
    }
}
