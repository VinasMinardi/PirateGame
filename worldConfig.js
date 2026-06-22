export const worldConfig = {
  seed: 421337,
  baseTileSize: 64,   // grade antiga usada por geracao, overrides e balanceamento
  tileSize: 16,       // grade logica/jogavel final
  tileSubdivision: 4, // 64 / 16
  baseChunkSize: 64,  // chunks da grade-base 64x64
  chunkSize: 256,     // chunks na grade final 16x16; mantem 4096px por chunk
  islandFrequency: 0.005,
  detailFrequency: 0.04,
  islandThreshold: 0.35, // Corte para virar terra
  spawnSearchRadius: 10   // Chunks para varrer atrás de spawn seguro
};
