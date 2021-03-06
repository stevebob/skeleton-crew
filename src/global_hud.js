import {Hud} from './hud.js';

export const GlobalHud = {
    init() {
        let hud = document.getElementById('hud');
        let weapon = document.getElementById('weapon');
        let message = document.getElementById('message');
        let stats = document.getElementById('stats');
        let atmosphere = document.getElementById('atmosphere');
        let overlay = document.getElementById('overlay');
        this.Hud = new Hud(hud, weapon, message, stats, atmosphere, overlay);
    }
};
