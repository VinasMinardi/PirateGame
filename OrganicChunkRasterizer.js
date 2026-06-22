export function renderOrganicChunkPixels({
  chunkX,
  chunkY,
  terrainField,
  config
}) {
  const chunkSize = config.chunkSizePx;
  const cellSize = config.visualCellSize;
  const supersampling = config.supersampling;
  const worldX = chunkX * chunkSize;
  const worldY = chunkY * chunkSize;
  const pixels = new Uint8ClampedArray(chunkSize * chunkSize * 4);
  const visualLayerCounts = {};

  for (let y = 0; y < chunkSize; y += cellSize) {
    for (let x = 0; x < chunkSize; x += cellSize) {
      const sample = terrainField.sampleOrganicTerrainCellAtWorld(
        worldX + x,
        worldY + y,
        cellSize,
        supersampling
      );
      const r = Math.max(0, Math.min(255, Math.round(sample.color.r)));
      const g = Math.max(0, Math.min(255, Math.round(sample.color.g)));
      const b = Math.max(0, Math.min(255, Math.round(sample.color.b)));

      visualLayerCounts[sample.visualLayer] = (visualLayerCounts[sample.visualLayer] ?? 0) + 1;

      for (let py = 0; py < cellSize; py++) {
        const pixelY = y + py;
        if (pixelY >= chunkSize) break;

        for (let px = 0; px < cellSize; px++) {
          const pixelX = x + px;
          if (pixelX >= chunkSize) break;

          const index = (pixelY * chunkSize + pixelX) * 4;
          pixels[index] = r;
          pixels[index + 1] = g;
          pixels[index + 2] = b;
          pixels[index + 3] = 255;
        }
      }
    }
  }

  return {
    pixels,
    width: chunkSize,
    height: chunkSize,
    visualLayerCounts
  };
}
