export class ClientState {
  constructor() {
    this.ships = [];
    this.localPlayerId = null;
  }

  updateFromSnapshot(snapshot, localId) {
    if (!snapshot) return;
    this.ships = snapshot.ships ?? [];
    this.localPlayerId = localId;
  }

  getLocalShip() {
    return this.ships.find(ship => ship.id === this.localPlayerId) || null;
  }
}
