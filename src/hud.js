import {Components} from './components.js';

export class Hud {
    constructor(container, weapon, message, stats, atmosphere, overlay) {
        this.container = container;
        this._weapon = weapon;
        this._message = message;
        this._stats = stats;
        this._atmosphere = atmosphere;
        this._overlay = overlay;

        this.messageChanged = false;
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
    }

    set stats(value) {
        this._stats.innerHTML = value;
    }

    set message(value) {
        this.messageChanged = true;
        this._message.innerHTML = value;
    }

    set weapon(value) {
        this._weapon.innerHTML = value;
    }

    set atmosphere(value) {
        this._atmosphere.innerHTML = value;
    }

    showOverlay() {
        this.hide();
        this._overlay.style.display = 'block';
    }

    hideOverlay() {
        this.show();
        this._overlay.style.display = 'none';
    }

    set overlay(value) {
        this._overlay.innerHTML = value;
    }

    update(entity) {
        let health = Math.ceil(entity.get(Components.Health).value); // ceil so 0.5 doesn't look like 0
        let maxHealth = Math.floor(entity.get(Components.MaxHealth).value);
        let oxygen = Math.floor(entity.get(Components.Oxygen).value);
        let maxOxygen = Math.floor(entity.get(Components.MaxOxygen).value);
        let atmosphereCell = entity.ecsContext.atmosphere.grid.get(entity.cell.coord);
        if (atmosphereCell.venting) {
            this.atmosphere = "<span style='color:#ff0000'>Venting</span>";
        } else if (atmosphereCell.atmosphere === 0) {
            this.atmosphere = "<span style='color:#8888ff'>Vacuum</span>";
        } else {
            this.atmosphere = "<span style='color:#ffffff'>Pressurized</span>";
        }

        let depth = entity.ecsContext.level.depth;

        this.stats = `Floor:${depth} O₂:${oxygen}/${maxOxygen} HP:${health}/${maxHealth}`;

        let weaponInventory =entity.get(Components.WeaponInventory);
        let weaponEntity = weaponInventory.currentWeapon;
        let currentWeaponName = "";
        if (weaponEntity !== null) {
            let weapon = weaponEntity.get(Components.Weapon).weapon;
            let name = weaponEntity.get(Components.Name).value;
            if (typeof name === 'function') {
                currentWeaponName = name(weaponEntity);
            } else {
                currentWeaponName = name;
            }
        }
        let weaponSummary = '[';
        for (let i = 1; i < weaponInventory.slots.length; ++i) {
            let slot = weaponInventory.slots[i];
            if (slot === null) {
                weaponSummary += `<span style='color:#444444'>${i}</span>`;
            } else if (i === weaponInventory.index) {
                weaponSummary += `<span style='color:#ff0000'>${i}</span>`;
            } else {
                weaponSummary += `<span style='color:#ffffff'>${i}</span>`;
            }
        }
        weaponSummary += ']';
        this.weapon = `${weaponSummary} ${currentWeaponName}`;

        if (!this.messageChanged) {
            let item = entity.cell.find(Components.Getable);
            if (item === null) {
                this.message = "";
            } else {
                this.message = `Here: ${item.get(Components.Name).value}`;
            }
        }
    }

}
