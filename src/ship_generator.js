import {makeEnum} from './utils/enum.js';
import {EntityPrototypes} from './entity_prototypes.js';
import {CellGrid, Cell} from './utils/cell_grid.js';
import {Config} from './config.js';
import {assert} from './utils/assert.js';
import {Vec2} from './utils/vec2.js';
import {Direction, Directions, CardinalDirections} from './utils/direction.js';
import {SearchQueue} from './utils/search_queue.js';
import * as Random from './utils/random.js';
import * as ArrayUtils from './utils/array_utils.js';
import {Components} from './components.js';
import {Level} from './engine/level.js';

const CONNECTIONS_WIDTH = 30;
const CONNECTIONS_HEIGHT = 18;

const CellType = makeEnum([
    'Floor',
    'Wall',
    'Void',
    'Door',
    'Window'
]);

class GeneratorCell extends Cell {
    constructor(x, y, grid) {
        super(x, y, grid);
        this.type = CellType.Void;
        this.hard = false;
        this.populated = false;
    }

    floodFillCompare(cell) {
        if ((this.type === CellType.Door || this.type === CellType.Floor) ===
            (cell.type === CellType.Door || cell.type === CellType.Floor)) {
            return 0;
        }
        return 1;
    }
}
class GeneratorGrid extends CellGrid(GeneratorCell) {}

class RoomCell extends Cell {
    constructor(x, y, grid) {
        super(x, y, grid);
        this.generatorCell = null;
    }

    floodFillCompare(cell) {
        if ((this.generatorCell.type === CellType.Floor) ===
               (cell.generatorCell.type === CellType.Floor)) {
            return 0;
        }
        return 1;
    }
}
class RoomGrid extends CellGrid(RoomCell) {}

const ConnectionCellType = makeEnum([
    'Undefined',
    'Hallway',
    'Room'
]);

class ConnectionCell extends Cell {
    constructor(x, y, grid) {
        super(x, y, grid);
        this.connected = new Array(8); // 8 directions
        this.doors = new Array(8); // 8 directions
        this.neverConnected = new Array(8); // 8 directions
        this.windows = new Array(8); // 8 directions
        for (let i = 0; i < 8; ++i) {
            this.connected[i] = false;
            this.doors[i] = false;
            this.neverConnected[i] = false;
            this.windows[i] = false;
        }
        this.type = ConnectionCellType.Undefined;
        this.cellType = CellType.Floor;
        this.distanceToHallway = -1;
        this.frontier = false;
        this.roomId = -1;
    }

    connect(direction) {
        let neighbour = this.getNeighbour(direction);
        assert(neighbour !== null);
        this.connected[direction.index] = true;
        neighbour.connected[direction.opposite.index] = true;
    }

    connectWithDoor(direction) {
        let neighbour = this.getNeighbour(direction);
        assert(neighbour !== null);
        this.doors[direction.index] = true;
        neighbour.doors[direction.opposite.index] = true;
    }

    connectWithWindow(direction) {
        let neighbour = this.getNeighbour(direction);
        this.windows[direction.index] = true;
        if (neighbour !== null) {
            neighbour.windows[direction.opposite.index] = true;
        }
    }

    neverConnect(direction) {
        let neighbour = this.getNeighbour(direction);
        assert(neighbour !== null);
        this.neverConnected[direction.index] = true;
        neighbour.neverConnected[direction.opposite.index] = true;
    }

    directionToAdjacentHallway() {
        for (let direction of CardinalDirections) {
            let neighbour = this.getNeighbour(direction);
            if (neighbour !== null && neighbour.type == ConnectionCellType.Hallway) {
                return direction;
            }
        }
        return null;
    }

    directionToAdjacentRoom() {
        for (let direction of CardinalDirections) {
            let neighbour = this.getNeighbour(direction);
            if (neighbour !== null && neighbour.type === ConnectionCellType.Room) {
                return direction;
            }
        }
        return null;
    }
}

class ConnectionGrid extends CellGrid(ConnectionCell) {}

class HallwayCandidate {
    constructor(startCoord, direction, length) {
        this.startCoord = startCoord;
        this.direction = direction;
        this.length = length;
    }
}

class DoorCandidate {
    constructor(cell, direction) {
        this.cell = cell;
        this.direction = direction;
    }
}

class WindowCandidate {
    constructor(cell, direction) {
        this.cell = cell;
        this.direction = direction;
    }
}

const RoomType = makeEnum([
    'Left',
    'Right',
    'SpawnCandidate',
    'Spawn',
    'None'
]);

class Room {
    constructor(id) {
        this.id = id;
        this.cells = [];
        this.minX = Config.GRID_WIDTH;
        this.maxX = -1;
        this.minY = Config.GRID_HEIGHT;
        this.maxY = -1;
        this.type = RoomType.None;
    }

    get width() {
        return Math.max(this.maxX - this.minX, 0);
    }

    get height() {
        return Math.max(this.maxY - this.minY, 0);
    }

    get squareSize() {
        return this.width * this.height;
    }

    get midX() {
        return (this.minX + this.maxX) / 2;
    }

    addCell(cell) {
        this.cells.push(cell);
        this.minX = Math.min(this.minX, cell.x);
        this.maxX = Math.max(this.maxX, cell.x);
        this.minY = Math.min(this.minY, cell.y);
        this.maxY = Math.max(this.maxY, cell.y);
    }
}

export class ShipGenerator {
    constructor(depth = 0, parent = null) {
        this.depth = depth;
        this.parent = parent;
    }
    init() {
        this.grid = new GeneratorGrid(Config.GRID_WIDTH, Config.GRID_HEIGHT);
        this.roomGrid = new RoomGrid(Config.GRID_WIDTH, Config.GRID_HEIGHT);
        this.connectionGrid = new ConnectionGrid(CONNECTIONS_WIDTH, CONNECTIONS_HEIGHT);

        this.numRooms = 0;

        this.connectedRooms = [];

        this.doorCandidates = [];

        this.rooms = [];
        this.spawnCandidateRooms = [];

        this.leftRoom = null;
        this.rightRoom = null;
        this.left = null;
        this.right = null;

        for (let cell of this.grid) {
            let roomCell = this.roomGrid.get(cell.coord);
            roomCell.generatorCell = cell;
        }
    }

    addDoorCandidate(a, b, cell, direction) {
        if (a > b) {
            let tmp = a;
            a = b;
            b = tmp;
        }
        if (this.doorCandidates[a] === undefined) {
            this.doorCandidates[a] = [];
        }
        if (this.doorCandidates[a][b] === undefined) {
            this.doorCandidates[a][b] = [];
        }
        this.doorCandidates[a][b].push(new DoorCandidate(cell, direction));
    }

    _connectRooms(a, b) {
        if (this.connectedRooms[a] === undefined) {
            this.connectedRooms[a] = [];
        }
        this.connectedRooms[a][b] = true;
    }
    connectRooms(a, b) {
        this._connectRooms(a, b);
        this._connectRooms(b, a);
    }
    connected(a, b) {
        if (this.connectedRooms[a] === undefined) {
            this.connectedRooms[a] = [];
        }
        return this.connectedRooms[a][b] === true;
    }

    *hallwayCandidates(minLength, maxLength) {
        while (true) {
            let direction = ArrayUtils.getRandomElement(CardinalDirections);
            let x = Random.getRandomInt(4, this.connectionGrid.width - 4);
            let y = Random.getRandomInt(4, this.connectionGrid.height - 4);
            let startCoord = new Vec2(x, y);
            let length = Random.getRandomIntInclusive(minLength, maxLength);
            let candidate = new HallwayCandidate(startCoord, direction, length);
            if (this.testHallwayCandidate(candidate)) {
                yield candidate;
            }
        }
    }

    testHallwayCandidate(candidate) {
        let startCell = this.connectionGrid.get(candidate.startCoord);
        if (startCell.distanceToEdge < 2) {
            return false;
        }
        let endCoord = candidate.startCoord.add(candidate.direction.vector.multiply(candidate.length));
        let endCell = this.connectionGrid.get(endCoord);
        if (endCell === null || endCell.distanceToEdge < 2) {
            return false;
        }
        return true;
    }


    setGridFromConnectionGrid(startX, startY) {
        let vec = new Vec2();
        for (let connectionCell of this.connectionGrid) {
            vec.set(
                startX + connectionCell.x * 2 + 1,
                startY + connectionCell.y * 2 + 1
            );
            let cell = this.grid.get(vec);
            if (connectionCell.type === ConnectionCellType.Undefined) {
                cell.type = CellType.Void;
            } else {
                cell.type = connectionCell.cellType;
            }
            for (let direction of Directions) {
                let neighbourCoord = cell.coord.add(direction.vector);
                let neighbourCell = this.grid.get(neighbourCoord);
                let neighbourConnectionCell = connectionCell.getNeighbour(direction);
                if (connectionCell.type === ConnectionCellType.Undefined) {
                    if (neighbourConnectionCell === null ||
                        neighbourConnectionCell.type === ConnectionCellType.Undefined) {

                        cell.type = CellType.Void;
                        continue;
                    }
                }
                if (neighbourCell.hard) {
                    continue;
                }
                if (connectionCell.connected[direction.index]) {
                    neighbourCell.type = CellType.Floor;
                } else {
                    if (neighbourCell.type !== CellType.Floor) {
                        neighbourCell.type = CellType.Wall;
                    }
                }
                if (connectionCell.doors[direction.index]) {
                    neighbourCell.type = CellType.Door;
                }
                if (connectionCell.windows[direction.index]) {
                    neighbourCell.type = CellType.Window;
                }
                if (connectionCell.neverConnected[direction.index]) {
                    neighbourCell.type = CellType.Wall;
                    neighbourCell.hard = true;
                }
            }
        }
    }

    addHallway(candidate) {
        let cell = this.connectionGrid.get(candidate.startCoord);

        let direction90 = candidate.direction.right90;
        let direction45 = candidate.direction.right45;

        for (let i = 0; i < candidate.length; ++i) {
            let above = cell.getNeighbour(direction90);
            let diagonal = cell.getNeighbour(direction45);
            let next = cell.getNeighbour(candidate.direction);
            if (above.type === ConnectionCellType.Hallway ||
                cell.type === ConnectionCellType.Hallway ||
                diagonal.type === ConnectionCellType.Hallway) {
                return false;
            }
            if (cell.distanceToHallway !== -1) {
                return false;
            }
            cell = next;
        }

        let roomId = this.numRooms;
        ++this.numRooms;
        cell = this.connectionGrid.get(candidate.startCoord);

        let queue = new SearchQueue();

        for (let i = 0; i < candidate.length; ++i) {
            let above = cell.getNeighbour(direction90);
            let diagonal = cell.getNeighbour(direction45);
            let next = cell.getNeighbour(candidate.direction);

            above.connect(candidate.direction);
            diagonal.connect(direction90.opposite);

            cell.connect(candidate.direction);
            cell.connect(direction45);
            cell.connect(direction90);

            cell.type = ConnectionCellType.Hallway;
            above.type = ConnectionCellType.Hallway;
            diagonal.type = ConnectionCellType.Hallway;
            next.type = ConnectionCellType.Hallway;

            queue.insert(cell);
            cell.distanceToHallway = 0;
            cell = next;
        }

        while (!queue.empty) {
            let cell = queue.remove();
            cell.roomId = roomId;
            for (let neighbour of cell.neighbours) {
                if (neighbour.distanceToHallway === -1) {
                    if (neighbour.type === ConnectionCellType.Hallway) {
                        neighbour.distanceToHallway = 0;
                    } else {
                        neighbour.distanceToHallway = cell.distanceToHallway + 1;
                    }
                    if (neighbour.distanceToHallway < 4) {
                        queue.insert(neighbour);
                    }
                }
            }
        }
        return true;
    }

    generateHallways(minAmount, maxAmount, minSize, maxSize) {
        let count = 0;
        let attempts = 0;
        const MAX_ATTEMPTS = 20;
        let target = Random.getRandomInt(minAmount, maxAmount);
        for (let candidate of this.hallwayCandidates(minSize, maxSize)) {
            if (this.addHallway(candidate)) {
                ++count;
            }
            if (count === target) {
                break;
            }
            ++attempts;
            if (attempts === MAX_ATTEMPTS) {
                break;
            }
        }
    }

    computeFrontier() {
        let queue = new SearchQueue();
        for (let cell of this.connectionGrid) {
            if (cell.type !== ConnectionCellType.Undefined) {
                queue.insert(cell);
            }
            cell.frontier = false;
        }
        let frontier = [];
        while (!queue.empty) {
            let cell = queue.remove();
            if (cell.type !== ConnectionCellType.Undefined) {
                for (let direction of Directions) {
                    let neighbour = cell.getNeighbour(direction);
                    if (neighbour !== null && neighbour.type === ConnectionCellType.Undefined) {
                        if (direction.cardinal) {
                            frontier.push(neighbour);
                            neighbour.frontier = true;
                        } else {
                            cell.neverConnect(direction);
                        }
                    }
                }
            }
        }
        return frontier;
    }

    generateRooms(minAmount, maxAmount) {
        let amount = Random.getRandomIntInclusive(minAmount, maxAmount);
        for (let i = 0; i < amount; ++i) {
            this.generateRoom();
        }

        for (let a of this.doorCandidates) {
            if (a !== undefined) {
                for (let b of a) {
                    if (b !== undefined) {
                        let candidate = ArrayUtils.getRandomElement(b);
                        candidate.cell.connectWithDoor(candidate.direction);
                    }
                }
            }
        }
    }

    generateRoom() {
        let roomId = this.numRooms;
        ++this.numRooms;

        let frontier = this.computeFrontier();
        ArrayUtils.shuffleInPlace(frontier);

        let startCell = frontier.pop();
        let direction = startCell.directionToAdjacentHallway();
        if (direction === null) {
            direction = startCell.directionToAdjacentRoom();
            assert(direction !== null);
        }
        startCell.connectWithDoor(direction);
        this.connectRooms(roomId, startCell.getNeighbour(direction).roomId);
        startCell.type = ConnectionCellType.Room;
        let queue = new SearchQueue();
        queue.insert(startCell);
        const maxSize = Random.getRandomInt(2, 5);

        startCell.roomId = roomId;

        while (!queue.empty) {
            let cell = queue.remove();

            for (let direction of Directions) {
                let neighbour = cell.getNeighbour(direction);
                if (neighbour !== null && neighbour.type === ConnectionCellType.Room &&
                    neighbour.roomId === cell.roomId) {
                    cell.connect(direction);
                }
            }

            for (let direction of CardinalDirections) {
                let neighbour = cell.getNeighbour(direction);
                if (neighbour !== null && neighbour.type === ConnectionCellType.Undefined) {
                    if (neighbour.coord.getSquareCircleDistance(startCell.coord) >= maxSize) {
                        continue;
                    }
                    neighbour.type = ConnectionCellType.Room;
                    neighbour.roomId = roomId;
                    cell.connect(direction);
                    queue.insert(neighbour);
                } else if (neighbour !== null && neighbour.type !== ConnectionCellType.Undefined &&
                    neighbour.roomId !== roomId) {
                    if (neighbour.roomId !== -1 && !this.connected(neighbour.roomId, roomId)) {
                        this.addDoorCandidate(neighbour.roomId, roomId, cell, direction);
                    }
                }
            }
        }
    }

    generateWindows(minAmount, maxAmount) {
        let candidates = [];
        for (let cell of this.connectionGrid) {
            if (cell.type === ConnectionCellType.Hallway ||
                cell.type === ConnectionCellType.Room) {
                for (let direction of CardinalDirections) {
                    let neighbour = cell.getNeighbour(direction);
                    if (neighbour === null || neighbour.type === ConnectionCellType.Undefined) {
                        candidates.push(new WindowCandidate(cell, direction));
                    }
                }
            }
        }

        ArrayUtils.shuffleInPlace(candidates);

        let amount = Math.min(Random.getRandomIntInclusive(minAmount, maxAmount), candidates.length);
        for (let i = 0; i < amount; ++i) {
            candidates[i].cell.connectWithWindow(candidates[i].direction);
        }
    }

    pickRoomCell(room) {
        ArrayUtils.shuffleInPlace(room.cells);
        for (let cell of room.cells) {
            let wallNeighbour = false;
            for (let neighbour of cell.neighbours) {
                if (neighbour.type !== CellType.Floor) {
                    wallNeighbour = true;
                    break;
                }
            }
            if (!wallNeighbour) {
                return cell;
            }
        }

        return room.cells[0];
    }

    classifyRooms() {
        for (let region of this.roomGrid.floodFill()) {
            let first = true;
            let isRoom = false;
            let room;
            let count = 0;
            for (let roomCell of region) {
                let cell = roomCell.generatorCell;
                if (first) {
                    first = false;
                    isRoom = cell.type === CellType.Floor;
                    if (isRoom) {
                        room = new Room(this.rooms.length);
                        this.rooms.push(room);
                    }
                }
                if (isRoom) {
                    room.addCell(cell);
                }
            }
        }

        this.rooms.sort((a, b) => {
            return a.midX - b.midX;
        });

        for (let i = 0; i < this.rooms.length; ++i) {
            let room = this.rooms[i];
            if (room.width > 2 && room.height > 2) {
                this.leftRoom = room;
                break;
            }
        }

        for (let i = this.rooms.length - 1; i >= 0; --i) {
            let room = this.rooms[i];
            if (room.width > 2 && room.height > 2 && room !== this.leftRoom) {
                this.rightRoom = room;
                break;
            }
        }

        this.leftRoom.type = RoomType.Left;
        this.rightRoom.type = RoomType.Right;

        for (let room of this.rooms) {
            if (room.type === RoomType.None &&
                room.width > 2 && room.height > 2) {
                room.type = RoomType.SpawnCandidate;
                this.spawnCandidateRooms.push(room);
            }
        }

        this.left = this.pickRoomCell(this.leftRoom);
        this.right = this.pickRoomCell(this.rightRoom);
    }

    spawnNpcs(minSpawns, maxSpawns, minPerSpawn, maxPerSpawn, ecsContext) {
        ArrayUtils.shuffleInPlace(this.spawnCandidateRooms);
        let numSpawns =
            Math.min(Random.getRandomIntInclusive(minSpawns, maxSpawns), this.spawnCandidateRooms.length);

        for (let i = 0; i < numSpawns; ++i) {
            let room = this.spawnCandidateRooms[i];
            ArrayUtils.shuffleInPlace(room.cells);
            let numNpcs = Math.min(room.cells.length, Random.getRandomIntInclusive(minPerSpawn, maxPerSpawn));
            for (let j = 0; j < numNpcs; ++j) {
                let cell = room.cells[j];
                ecsContext.emplaceEntity(EntityPrototypes.Zombie(cell.x, cell.y));
            }
            if (numNpcs < room.cells.length) {
                let cell = room.cells[numNpcs];
                if (i === 0 || Math.random() < 0.5) {
                    cell.populated = true;
                    if (Math.random() < 0.3) {
                        ecsContext.emplaceEntity(EntityPrototypes.Skeleton(cell.x, cell.y));
                    } else {
                        ecsContext.emplaceEntity(EntityPrototypes.Bloat(cell.x, cell.y));
                    }
                }
            }
        }
    }

    spawnWeapons(minWeapons, maxWeapons, numWeaponTypes, weapons, ecsContext) {
        ArrayUtils.shuffleInPlace(weapons);
        let chosenWeapons = weapons.slice(0, numWeaponTypes);

        ArrayUtils.shuffleInPlace(this.spawnCandidateRooms);
        let numWeapons =
            Math.min(Random.getRandomIntInclusive(minWeapons, maxWeapons), this.spawnCandidateRooms.length);

        for (let i = 0; i < numWeapons; ++i) {
            let room = this.spawnCandidateRooms[i];
            ArrayUtils.shuffleInPlace(room.cells);
            let weaponCell = room.cells[0];
            for (let cell of room.cells) {
                if (!cell.populated) {
                    weaponCell = cell;
                    break;
                }
            }
            weaponCell.populated = true;
            let weaponEntity = ecsContext.emplaceEntity(
                            ArrayUtils.getRandomElement(chosenWeapons)(weaponCell.x, weaponCell.y));
            let weapon = weaponEntity.get(Components.Weapon).weapon;
            weapon.ammo = Random.getRandomIntInclusive(
                Math.floor(weapon.maxAmmo/4),
                Math.floor(weapon.maxAmmo/2)
            );
        }

        return chosenWeapons;
    }

    spawnHealthKits(minHealthKits, maxHealthKits, ecsContext) {
        let numHealthKits =
            Math.min(Random.getRandomIntInclusive(minHealthKits, maxHealthKits), this.spawnCandidateRooms.length);
        for (let i = 0; i < numHealthKits; ++i) {
            let room = this.spawnCandidateRooms[i];
            ArrayUtils.shuffleInPlace(room.cells);
            let healthKitCell = room.cells[0];
            for (let cell of room.cells) {
                if (!cell.populated) {
                    healthKitCell = cell;
                    break;
                }
            }
            healthKitCell.populated = true;
            ecsContext.emplaceEntity(EntityPrototypes.HealthKit(healthKitCell.x, healthKitCell.y));
        }
    }

    tryGenerate() {
        this.init();

        this.generateHallways(2, 2, 10, 20);
        this.generateHallways(2, 2, 7, 12);
        this.generateHallways(2, 2, 4, 8);
        this.generateRooms(12, 20);
        this.generateWindows(30, 40);
        this.setGridFromConnectionGrid(1, 1);

        let count = 0;
        for (let region of this.grid.floodFill()) {
            let first = true;
            for (let cell of region) {
                if (first) {
                    first = false;
                    if (cell.type === CellType.Door || cell.type === CellType.Floor) {
                        ++count;
                    }
                }
            }
        }

        return count === 1;
    }

    generate(level, ecsContext) {

        this.level = level;

        if (this.depth === Config.DEPTH) {
            this.finalLevel = true;
        } else {
            this.finalLevel = false;
        }

        if (this.depth === 1) {
            this.firstLevel = true;
        } else {
            this.firstLevel = false;
        }

        if (this.finalLevel) {
            this.nextLevel = null;
        } else {
            this.nextLevel = new Level(new ShipGenerator(this.depth + 1, this));
        }

        while (!this.tryGenerate());

        this.classifyRooms();
        this.spawnNpcs(7, 10, 1, 3, ecsContext);
        let chosenWeapons = this.spawnWeapons(4, 8, 4, [
            EntityPrototypes.Pistol,
            EntityPrototypes.Shotgun,
            EntityPrototypes.MachineGun,
            EntityPrototypes.Flamethrower,
            EntityPrototypes.RocketLauncher
        ], ecsContext);
        this.spawnHealthKits(3, 6, ecsContext);

        for (let cell of this.grid) {
            switch (cell.type) {
                case CellType.Door: {
                    ecsContext.emplaceEntity(EntityPrototypes.Door(cell.x, cell.y));
                    ecsContext.emplaceEntity(EntityPrototypes.Floor(cell.x, cell.y));
                    break;
                }
                case CellType.Void: {
                    ecsContext.emplaceEntity(EntityPrototypes.Void(cell.x, cell.y));
                    break;
                }
                case CellType.Wall: {
                    ecsContext.emplaceEntity(EntityPrototypes.Wall(cell.x, cell.y));
                    ecsContext.emplaceEntity(EntityPrototypes.Floor(cell.x, cell.y));
                    break;
                }
                case CellType.Floor: {
                    ecsContext.emplaceEntity(EntityPrototypes.Floor(cell.x, cell.y));
                    break;
                }
                case CellType.Window: {
                    ecsContext.emplaceEntity(EntityPrototypes.Window(cell.x, cell.y));
                    ecsContext.emplaceEntity(EntityPrototypes.Floor(cell.x, cell.y));
                    break;
                }
            }
        }

        let source, destination;
        if (this.depth % 2 == 1) {
            source = this.left;
            destination = this.right;
        } else {
            source = this.right;
            destination = this.left;
        }

        if (this.firstLevel) {
            let pc = ecsContext.emplaceEntity(EntityPrototypes.PlayerCharacter(source.x, source.y));
            let startWeaponEntity = ecsContext.emplaceEntity(EntityPrototypes.Pistol(source.x, source.y));
            let startWeapon = startWeaponEntity.get(Components.Weapon).weapon;
            startWeapon.ammo = 50;
            startWeaponEntity.remove(Components.Position);
            pc.get(Components.WeaponInventory).addWeapon(startWeaponEntity);
        } else {
            let stairs = ecsContext.emplaceEntity(EntityPrototypes.UpStairs(source.x, source.y));
            this.parent.downStairs.get(Components.DownStairs).upStairs = stairs;
            stairs.get(Components.UpStairs).downStairs = this.parent.downStairs;
            stairs.get(Components.UpStairs).level = this.parent.level;
        }

        if (this.finalLevel) {
            let teleport = ecsContext.emplaceEntity(EntityPrototypes.Teleport(destination.x, destination.y));
        } else {
            let stairs = ecsContext.emplaceEntity(EntityPrototypes.DownStairs(destination.x, destination.y));
            stairs.get(Components.DownStairs).level = this.nextLevel;
            this.downStairs = stairs;
        }

    }
}
