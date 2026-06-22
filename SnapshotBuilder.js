import { getSectorAtWorld } from '../shared/world/SectorGrid.js';

export class SnapshotBuilder {
  static serializeShip(ship) {
    const sector = getSectorAtWorld(ship.x, ship.y);

    return {
      id: ship.id,
      x: Number(ship.x.toFixed(2)),
      y: Number(ship.y.toFixed(2)),
      r: Number(ship.rotation.toFixed(3)),
      s: Number(ship.sail.toFixed(2)),
      rud: Number(ship.rudder.toFixed(2)),
      anc: ship.anchorDown,
      spd: Number(ship.speed.toFixed(2)),
      wa: Number(ship.windAngle.toFixed(2)),
      ws: Number(ship.windStrength.toFixed(1)),
      n: ship.name,
      sec: sector.id,
      sectorCol: sector.col,
      sectorRow: sector.row
    };
  }

  static createDeltaSnapshot(simulation, tickCounter) {
    return {
      t: tickCounter,
      ts: Date.now(),
      ships: simulation.getState().map(ship => this.serializeShip(ship))
    };
  }

  static createDeltaSnapshotForRecipient(simulation, tickCounter, recipientId) {
    const allShips = simulation.getState();
    const recipient = allShips.find(ship => ship.id === recipientId);

    if (!recipient) {
      return {
        t: tickCounter,
        ts: Date.now(),
        ships: []
      };
    }

    const recipientSector = getSectorAtWorld(recipient.x, recipient.y);

    const visibleShips = allShips.filter(ship => {
      const shipSector = getSectorAtWorld(ship.x, ship.y);
      return ship.id === recipientId || shipSector.id === recipientSector.id;
    });

    return {
      t: tickCounter,
      ts: Date.now(),
      ships: visibleShips.map(ship => this.serializeShip(ship))
    };
  }
}
