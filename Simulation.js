import { SailingSystem } from './systems/SailingSystem.js';
export class Simulation {
  constructor(worldModel) {
    this.worldModel = worldModel;
    this.ships = new Map();

    this.globalWindAngle = 0.5;
    this.globalWindStrength = 4.0;
  }

  addShip(id) {
    const spawn = this.worldModel.getSpawnPoint();
    this.ships.set(id, {
      id: id,
      x: spawn.x,
      y: spawn.y,
      rotation: 0,
      velocityX: 0,
      velocityY: 0,
      angularVelocity: 0,
      sail: 0.0,
      rudder: 0.0,
      anchorDown: false,
      speed: 0,
      windAngle: this.globalWindAngle,
      windStrength: this.globalWindStrength,
      name: `Capitão_${id.substring(0, 4)}`
    });
    return this.ships.get(id);
  }

  removeShip(id) {
    this.ships.delete(id);
  }

  processInput(id, input) {
    const ship = this.ships.get(id);
    if (!ship) return;

    SailingSystem.update(ship, input, this.worldModel, 0.05);
    ship.x += ship.velocityX * 0.05;
    ship.y += ship.velocityY * 0.05;

    if (this.worldModel && typeof this.worldModel.clampToWorld === 'function') {
      const clamped = this.worldModel.clampToWorld(ship.x, ship.y);
      ship.x = clamped.x;
      ship.y = clamped.y;
    }
  }

  tick() {
    this.globalWindAngle = (this.globalWindAngle + 0.0002) % (Math.PI * 2);
    for (const ship of this.ships.values()) {
      ship.windAngle = this.globalWindAngle;
      ship.windStrength = this.globalWindStrength;
    }
  }

  getState() {
    return Array.from(this.ships.values());
  }
}
