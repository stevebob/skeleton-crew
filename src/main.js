import './manual_types.js';
import './populate_namespaces.js';

import {initConfigFromUrl} from './options.js';
import {Config} from './config.js';
import {initGlobals} from './globals.js';
import {GlobalHud} from './global_hud.js';

import {StringTerrainGenerator} from './string_terrain_generator.js';
import {ShipGenerator} from './ship_generator.js';

import {Level} from './engine/level.js';
import {GameContext} from './game_context.js';

import {Components} from './components.js';

import {help} from './control.js';
import {getKey} from './utils/input.js';
import {msDelay} from './utils/time.js';
import {assert} from './utils/assert.js';

import {renderText, HelpText, WinText} from './text.js';

function initRng() {
    let seed;
    if (Config.RNG_SEED === null) {
        seed = Date.now();
    } else {
        seed = Config.RNG_SEED;
    }
    console.log(seed);
    Math.seedrandom(seed);
}

const LOADING_SCREEN = renderText([
        'Loading...Generating...',
        ''
    ].concat(HelpText)
);

const LOADED_SCREEN = renderText([
        'Loading...Generating...<span style="color:green">Ready</span>',
        '',
    ].concat(HelpText).concat([
        '',
        '<span style="color:red">Press any key to start</start>'
    ])
);

export async function main() {
    initConfigFromUrl();
    initRng();

    await initGlobals();

    var terrainStringArrayL1 = [
"",
"                      #############=##########",
"                      #......................#",
"                      #......................#",
"                      #......................#",
"                      #......................#",
"                      #......................#",
"                      #......................#",
"                      #########%%%.%%#########",
"                              #......#",
"                              #......#",
" ###########                  #......#",
" #.........#                  #......#                 ########",
" #.........####################......########=##########......#",
" #.........%..................%......%.................%......#",
" #.........+..................+......+.................+......#",
" #.........%..................%......%.................%......#",
" #.........##############=#####......###########=#######......#",
" #.........#                  #......#                 #......#",
" ###########                  #......#                 ########",
"                              #......#",
"                              #......#",
"                    #####=#####%%%%%+###########",
"                    #..................%.......#",
"                    #..................%.......#",
"                    =..................%.......#",
"                    #..................%.......#",
"                    #..................+.......#",
"                    #..................%.......#",
"                    #%%%%%%%%%%%+%%%%%%%%%%%%%%#",
"                    #..............%......54123#",
"                    #..............%......@....#",
"                    #..............%...........#",
"                    #........$.....+...........=",
"                    #..............%...........#",
"                    #..............%...........#",
"                    #..............%...........#",
"                    ######=#####################",
""
    ];

    var first = true;
    Level.EcsContext = GameContext;
    let hud = GlobalHud.Hud;

    while (true) {
        hud.overlay = LOADING_SCREEN;
        hud.showOverlay();
        await msDelay(30);

        var generator;
        if (Config.DEMO) {
            generator = new StringTerrainGenerator(1, terrainStringArrayL1, null);
        } else {
            generator = new ShipGenerator(1);
        }

        var firstLevel = new Level(generator);
        var playerCharacter = firstLevel.ecsContext.playerCharacter;

        if (first) {
            first = false;
            hud.overlay = LOADED_SCREEN;
            await getKey();
        }

        hud.hideOverlay();

        hud.message = 'SHIP COMPUTER: "Get to the teleporter on Floor 3"';

        var currentEcsContext;
        while (true) {
            currentEcsContext = playerCharacter.ecsContext;
            if (playerCharacter.get(Components.Health).value <= 0) {
                currentEcsContext.updatePlayer();
                currentEcsContext.drawer.fill('rgba(255, 0, 0, 0.25)');
                hud.message = "You died (press any key to restart)"
                break;
            }
            if (playerCharacter.has(Components.StuckInSpace)) {
                currentEcsContext.updatePlayer();
                currentEcsContext.drawer.fill('rgba(255, 0, 0, 0.25)');
                hud.message = "You drift in space forever (press any key to restart)"
                break;
            }
            if (playerCharacter.has(Components.Won)) {
                hud.overlay = renderText(WinText);
                hud.showOverlay();
                break;
            }
            await currentEcsContext.progressSchedule();
        }

        await getKey();

        currentEcsContext.hud.message = "";
   }
}

window.onload = function() {
  main()
};
