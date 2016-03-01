import 'populate_namespaces.js';

import {initConfigFromUrl} from 'options.js';
import {Config} from 'config.js';
import {initGlobals} from 'globals.js';

import {StringTerrainGenerator} from 'string_terrain_generator.js';
import {ConwayTerrainGenerator} from 'conway_terrain_generator.js';
import {Level} from 'engine/level.js';

import {Components} from 'components.js';

import {help} from 'control.js';
import {getKey} from 'utils/input.js';
import {assert} from 'utils/assert.js';

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
'&             #........#........#..>.......~~........#      & &&',
'&     #############.####........#....................#   &    &&',
'&     #................#........c.......@............#        &&',
'&   & #.........................#....................#        &&',
'&     #................#........#....................#  &     &&',
'&     #................#........#....................#        &&',
'&  &  +................#........#....................#  &     &&',
'&     #................#........#....................#      & &&',
'&  &  #................###############.###############        &&',
'&     #................#...................#                  &&',
'&     #................#...................########        &  &&',
'&     ##################...................#      #           &&',
'&                      #...................#      #   &       &&',
'&   & &  &             #...................-      #       &   &&',
'&         &            #...................#      #&  &   &   &&',
'&    &&  & &        &  #...................#      # &         &&',
'&     &    &        &  #...................########       &   &&',
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

    var first = true;

    while (true) {
        var generator = new StringTerrainGenerator(1, terrainStringArrayL1, terrainStringArrayL2);
        if (!Config.DEMO) {
            generator = new ConwayTerrainGenerator(1, true);
        }
        var firstLevel = new Level(generator);
        var playerCharacter = firstLevel.ecsContext.playerCharacter;

        if (first) {
            first = false;
            help(playerCharacter);
        }

        var currentEcsContext;

        while (true) {
            currentEcsContext = playerCharacter.ecsContext;
            if (playerCharacter.get(Components.Health).value <= 0) {
                currentEcsContext.updatePlayer();
                currentEcsContext.hud.message = "You Died (press any key to restart)"
                break;
            }
            if (currentEcsContext.victory) {
                currentEcsContext.updatePlayer();
                currentEcsContext.hud.message = "The fallen Pyro God was defeated.";
                break;
            }
            await currentEcsContext.progressSchedule();
        }


        await getKey();

        currentEcsContext.hud.message = "";
    }
}
