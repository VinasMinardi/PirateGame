import { worldConfig } from '../config/worldConfig.js';
import {
  clampWorldToMap,
  getSectorAtWorld,
  getWorldBoundsWorld,
  isWorldInsideWorld
} from './SectorGrid.js';

export class WorldModel {
  constructor(seed = worldConfig.seed) {
    this.seed = seed;
    this.chunksGeneratedCount = 0;
    this.tileResolutionMetrics = {
      organicTilesClassified: 0
    };
  }

  isInsideWorldAtWorld(worldX, worldY, padding = 0) {
    return isWorldInsideWorld(worldX, worldY, padding);
  }

  getSectorAtWorld(worldX, worldY) {
    return getSectorAtWorld(worldX, worldY);
  }

  getMapBoundsWorld(padding = 0) {
    return getWorldBoundsWorld(padding);
  }

  clampToWorld(worldX, worldY, padding = 0) {
    return clampWorldToMap(worldX, worldY, padding);
  }

  getSpawnPoint() {
    return {
      x: worldConfig.spawnPoint?.x ?? -8192,
      y: worldConfig.spawnPoint?.y ?? -8192
    };
  }
}
