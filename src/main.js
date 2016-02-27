import './populate_namespaces.js';

import {initConfigFromUrl} from './options.js';
import {Config} from './config.js';
import {initGlobals} from './globals.js';

import {StringTerrainGenerator} from './string_terrain_generator.js';
import {ConwayTerrainGenerator} from './conway_terrain_generator.js';
import {Level} from './level.js';

import {Components} from './components.js';

import {getKey} from './input.js';
import {assert} from './assert.js';

function initRng() {
    let seed;
    if (Config.RNG_SEED == null) {
        seed = Date.now();
    } else {
        seed = Config.RNG_SEED;
    }
    console.debug(seed);
    Math.seedrandom(seed);
}

export async function main() {
    initConfigFromUrl();
    initRng();

    await initGlobals();

    var terrainStringArrayL1 = [
'&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&',
'&                                               &             &&',
'&  &             &   &  &&               &                    &&',
'&   &      &         & &        ######################    &&  &&',
'&    &                          #....................#     && &&',
'&      &      ###################....................#      &&&&',
'&      &      #........#........#....................#        &&',
'& &   &       #........#........#...........~........#  &     &&',
'&             #........#........#..........~~~.......#   &    &&',
'& &           #.................#..........~~~.......+        &&',
'&             #........#........#..>@......~~...c....#      & &&',
'&     #############.####........#....................#   &    &&',
'&     #................#.............................#        &&',
'&   & #.........................#....................#        &&',
'&     #................#........#....................#  &     &&',
'&     #................#........#....................#        &&',
'&  &  +................#........#....................#  &     &&',
'&     #................#........#....................#      & &&',
'&  &  #................###############.###############        &&',
'&     #................#...................#                  &&',
'&     #................#...................#               &  &&',
'&     ##################...................#                  &&',
'&                      #...................#          &       &&',
'&   & &  &             #...................-      &       &   &&',
'&         &            #...................#       &  &   &   &&',
'&    &&  & &        &  #...................#        &         &&',
'&     &    &        &  #...................#              &   &&',
'&      &    &&&        #####################              &   &&',
'&                                                             &&',
'&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&',
    ];

    var terrainStringArrayL2 = [
'%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
'%,,,,,,,,,,,%%%%%%%%%%%%%%%%%%%%%,,,,,,,,%%%%%%%%%%%%%%%%%%%%%%%',
'%,,,,,,,,%%%%%%%%%,,,,,,,,%%%%%%%%%%%%%%%%%,,,,,,,,,,,,,,%%%%%%%',
'%%,,,,%%%%%%%,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,%%%%',
'%%,,,,%%%%,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,%%%',
'%%,,,,%%,,,,,,,,,,,%%%%%%%%%%%%%%%%%%%,,,,,,,,,,,,,,,,,,,,,,,,%%',
'%%,,%%%,,,,,,,,,,,,%%%%%,,,,,,,%%%%%%,,,,,,,,,,,,,c,,,,,,,,,,,,%',
'%%%%%%,,,,,,,,,,,,,%,%,,,,,,,,%%,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,%',
'%%%%%,,,,,,,,,,,,,,%,%,,,,,,,%%%,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,%',
'%%%%,,,,,,,,,,,,,,%%%%,,,,,,%%%,,,,,,,<,,,,,,,,,%%%%%%,,,,,,,,%%',
'%%%%,,,,,,,,,,,%%%%%%,,,,,,%%%%,,,,,,,,,,,,,,,%%%%%%%%%%%%,,,,%%',
'%,%,,,,,,,,,,,,%%%%%,,,,,,,%%%,,,,,,,,,,,,,,%%%%%,,,,,,,%%%%%%%%',
'%%%,,,,,,,,%%%%%%,,,,,,,,,,,%%,,,,,,,,,,,,,%%%%%,,,,,,,,,%%%%%%%',
'%%%,,,,,,%%%%%%%,,,,,,,,,,,,%%%,,,,,,,,,,%%%%%%,,,,,,,,,,,,,,,%%',
'%%,,,,,,,,%%%,,,,,,,,,,,,,,,%%%,,,,,,,,,%%%%,,,,,,,,,,,,,,,,,,,%',
'%%,,,,,,,,%%%%,,,,,,,,,,,,,,%%%,,,,,,,,,%%%,,,,,,,,,,,,,,,,,,,,%',
'%%,,,,,,,,,%%%%%%%%%%%%%%%%%%%,,,,,,,,,,%%%%%%,,,,,,,,,,,,,,,,,%',
'%%,,,,,,,,,,,,%%%%%%%%%%%%%%%,,,,,,,,,,,~~%%%%%%,,,,,,,,,,,,,,,%',
'%%,,,,,,,,,,,,,,,,,,,,,%%,,,,,,,,,,,,,,,,~~,,%%%%,,,,,,,,,,,,,,%',
'%%,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~,,,,,%%%,,,,,,,,,,,,%',
'%%,,,,,,,,,,,,,,,%%,,,,,,,,,,,,,,%%%,,,,,~~,,,,,,%%,,,,,,,,,,,,%',
'%%,,,,,,,,,,,%%%%%%%%%%%%%%%%%%%%%%%%,,,,,~~~~~~~~%%,,,,,,,,,,,%',
'%%,,,,,,,,,,%%%%%%%%%%%%%%%%%%%%%%%%%,,,,,,,,~~~~%%%,,,,,,,,,,,%',
'%%%,,,,,,,,,%%%%%%%%%%%%%%%%%%%%%%%%,,,,,,,,,,,%%%%%,,,,,,,,,,,%',
'%,%,,,,,,,,,,%%%%%%%%%%%%%%%%%%%%%%,,,,,,,,,,,,%%%%%%%,,,,,,,,,%',
'%%%,,,,,,,,,,,,%%%%%%%%%%%%%%%%%%,,,,,,,,,,,,,,,,,%%%%%%%%%,,,,%',
'%%%,,,,,,,,,,,,,,,,%%%%%%%%%%,,,,,,,,,,,,,,,,,,,,,,,,,,%%%%%%%%%',
'%%%%%,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,%%%%%',
'%%,,%%%%%%%%,,,,,,,,,,,,,,,,,,,,,,%%%%%%%%%%%,,,,,,,,,%%%%%%,,,%',
'%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%',
    ];

    var generator = new StringTerrainGenerator(terrainStringArrayL1, terrainStringArrayL2);
    if (!Config.DEMO) {
        generator = new ConwayTerrainGenerator();
    }
    while (true) {
        var firstLevel = new Level(generator);
        var playerCharacter = firstLevel.ecsContext.playerCharacter;

        var currentEcsContext;

        while (true) {
            currentEcsContext = playerCharacter.ecsContext;
            if (playerCharacter.get(Components.Health).value <= 0) {
                break;
            }
            await currentEcsContext.progressSchedule();
        }
        currentEcsContext.updatePlayer();

        currentEcsContext.hud.message = "You Died (press any key to restart)"

        await getKey();

        currentEcsContext.hud.message = "";
    }
}
