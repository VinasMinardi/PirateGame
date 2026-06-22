import { worldConfig } from '../config/worldConfig.js';
import { sectorConfig } from '../config/sectorConfig.js';

export function getSectorSizeTiles() {
  return sectorConfig.sectorSizeTiles;
}

export function getBaseSectorSizeTiles() {
  return sectorConfig.baseSectorSizeTiles;
}

export function getSectorSizeWorld() {
  return sectorConfig.sectorSizeTiles * worldConfig.tileSize;
}

export function getWorldSizeTiles() {
  return {
    width: sectorConfig.columns * sectorConfig.sectorSizeTiles,
    height: sectorConfig.rows * sectorConfig.sectorSizeTiles
  };
}

export function getBaseWorldSizeTiles() {
  return {
    width: sectorConfig.columns * sectorConfig.baseSectorSizeTiles,
    height: sectorConfig.rows * sectorConfig.baseSectorSizeTiles
  };
}

export function getWorldBoundsTiles() {
  const size = getWorldSizeTiles();

  return {
    minTileX: -Math.floor(size.width / 2),
    maxTileX: Math.ceil(size.width / 2),
    minTileY: -Math.floor(size.height / 2),
    maxTileY: Math.ceil(size.height / 2),
    width: size.width,
    height: size.height
  };
}

export function getBaseWorldBoundsTiles() {
  const size = getBaseWorldSizeTiles();

  return {
    minTileX: -Math.floor(size.width / 2),
    maxTileX: Math.ceil(size.width / 2),
    minTileY: -Math.floor(size.height / 2),
    maxTileY: Math.ceil(size.height / 2),
    width: size.width,
    height: size.height
  };
}

export function getWorldBoundsWorld(padding = 0) {
  const b = getWorldBoundsTiles();

  return {
    minX: b.minTileX * worldConfig.tileSize + padding,
    maxX: b.maxTileX * worldConfig.tileSize - padding,
    minY: b.minTileY * worldConfig.tileSize + padding,
    maxY: b.maxTileY * worldConfig.tileSize - padding,
    width: b.width * worldConfig.tileSize,
    height: b.height * worldConfig.tileSize
  };
}

export function getBaseWorldBoundsWorld(padding = 0) {
  const b = getBaseWorldBoundsTiles();

  return {
    minX: b.minTileX * worldConfig.baseTileSize + padding,
    maxX: b.maxTileX * worldConfig.baseTileSize - padding,
    minY: b.minTileY * worldConfig.baseTileSize + padding,
    maxY: b.maxTileY * worldConfig.baseTileSize - padding,
    width: b.width * worldConfig.baseTileSize,
    height: b.height * worldConfig.baseTileSize
  };
}

export function isTileInsideWorld(tileX, tileY) {
  const b = getWorldBoundsTiles();

  return (
    tileX >= b.minTileX &&
    tileX < b.maxTileX &&
    tileY >= b.minTileY &&
    tileY < b.maxTileY
  );
}

export function isBaseTileInsideWorld(tileX, tileY) {
  const b = getBaseWorldBoundsTiles();

  return (
    tileX >= b.minTileX &&
    tileX < b.maxTileX &&
    tileY >= b.minTileY &&
    tileY < b.maxTileY
  );
}

export function isWorldInsideWorld(worldX, worldY, padding = 0) {
  const b = getWorldBoundsWorld(padding);

  return (
    worldX >= b.minX &&
    worldX <= b.maxX &&
    worldY >= b.minY &&
    worldY <= b.maxY
  );
}

export function clampWorldToMap(worldX, worldY, padding = 0) {
  const b = getWorldBoundsWorld(padding);

  return {
    x: Math.max(b.minX, Math.min(b.maxX, worldX)),
    y: Math.max(b.minY, Math.min(b.maxY, worldY))
  };
}

export function getSectorBoundsWorld(col, row) {
  const b = getWorldBoundsTiles();
  const sizeTiles = sectorConfig.sectorSizeTiles;

  const minTileX = b.minTileX + col * sizeTiles;
  const minTileY = b.minTileY + row * sizeTiles;
  const maxTileX = minTileX + sizeTiles;
  const maxTileY = minTileY + sizeTiles;

  return {
    minX: minTileX * worldConfig.tileSize,
    minY: minTileY * worldConfig.tileSize,
    maxX: maxTileX * worldConfig.tileSize,
    maxY: maxTileY * worldConfig.tileSize,
    width: sizeTiles * worldConfig.tileSize,
    height: sizeTiles * worldConfig.tileSize
  };
}

export function getSectorAtTile(tileX, tileY) {
  const b = getWorldBoundsTiles();

  if (!isTileInsideWorld(tileX, tileY)) {
    return {
      id: 'FORA',
      col: -1,
      row: -1,
      colLabel: '-',
      rowLabel: '-',
      isInside: false,
      boundsWorld: null
    };
  }

  const relX = tileX - b.minTileX;
  const relY = tileY - b.minTileY;

  const col = Math.max(0, Math.min(
    sectorConfig.columns - 1,
    Math.floor(relX / sectorConfig.sectorSizeTiles)
  ));

  const row = Math.max(0, Math.min(
    sectorConfig.rows - 1,
    Math.floor(relY / sectorConfig.sectorSizeTiles)
  ));

  const colLabel = sectorConfig.columnLabels[col] || String.fromCharCode(65 + col);
  const rowLabel = String(row + 1);

  return {
    id: `${colLabel}${rowLabel}`,
    col,
    row,
    colLabel,
    rowLabel,
    isInside: true,
    boundsWorld: getSectorBoundsWorld(col, row)
  };
}

export function getSectorAtBaseTile(tileX, tileY) {
  const b = getBaseWorldBoundsTiles();

  if (!isBaseTileInsideWorld(tileX, tileY)) {
    return {
      id: 'FORA',
      col: -1,
      row: -1,
      colLabel: '-',
      rowLabel: '-',
      isInside: false,
      boundsWorld: null
    };
  }

  const relX = tileX - b.minTileX;
  const relY = tileY - b.minTileY;

  const col = Math.max(0, Math.min(
    sectorConfig.columns - 1,
    Math.floor(relX / sectorConfig.baseSectorSizeTiles)
  ));

  const row = Math.max(0, Math.min(
    sectorConfig.rows - 1,
    Math.floor(relY / sectorConfig.baseSectorSizeTiles)
  ));

  const colLabel = sectorConfig.columnLabels[col] || String.fromCharCode(65 + col);
  const rowLabel = String(row + 1);

  return {
    id: `${colLabel}${rowLabel}`,
    col,
    row,
    colLabel,
    rowLabel,
    isInside: true,
    boundsWorld: getSectorBoundsWorld(col, row)
  };
}

export function getSectorAtWorld(worldX, worldY) {
  const tileX = Math.floor(worldX / worldConfig.tileSize);
  const tileY = Math.floor(worldY / worldConfig.tileSize);

  return getSectorAtTile(tileX, tileY);
}

export function getSectorBoundariesInTileRange(minTileX, maxTileX, minTileY, maxTileY) {
  const b = getWorldBoundsTiles();
  const size = sectorConfig.sectorSizeTiles;
  const vertical = [];
  const horizontal = [];

  for (let i = 0; i <= sectorConfig.columns; i++) {
    const tx = b.minTileX + i * size;
    if (tx >= minTileX && tx <= maxTileX) vertical.push(tx);
  }

  for (let i = 0; i <= sectorConfig.rows; i++) {
    const ty = b.minTileY + i * size;
    if (ty >= minTileY && ty <= maxTileY) horizontal.push(ty);
  }

  return { vertical, horizontal };
}
