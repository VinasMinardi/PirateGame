import { deflateSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import {
  mkdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OrganicTerrainField } from '../src/client/render/organic/OrganicTerrainField.js';
import { renderOrganicChunkPixels } from '../src/client/render/organic/OrganicChunkRasterizer.js';
import {
  ORGANIC_BAKE_CONFIG,
  organicTerrainConfig
} from '../src/client/render/organic/organicTerrainConfig.js';
import { createOrganicConfigHash } from '../src/client/render/organic/OrganicChunkDiskCache.js';
import { WorldModel } from '../src/shared/world/WorldModel.js';
import { getWorldBoundsWorld } from '../src/shared/world/SectorGrid.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {
    radius: 4,
    center: 'spawn',
    all: false,
    force: false,
    clear: false,
    from: null,
    to: null
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--all') args.all = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--clear') args.clear = true;
    else if (arg === '--radius') args.radius = Number(argv[++i] ?? args.radius);
    else if (arg === '--center') args.center = argv[++i] ?? args.center;
    else if (arg === '--from') args.from = parseCoord(argv[++i]);
    else if (arg === '--to') args.to = parseCoord(argv[++i]);
  }

  return args;
}

function parseCoord(value) {
  const [x, y] = String(value ?? '').split(',').map((part) => Number(part.trim()));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Coordenada invalida: ${value}`);
  }

  return { x, y };
}

function makeCrcTable() {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;

    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;

  for (let i = 0; i < buffer.length; i++) {
    crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng({ pixels, width, height }) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    raw[rowOffset] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, rowOffset + 1);
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 6 })),
    pngChunk('IEND')
  ]);
}

function chunkFileName(chunkX, chunkY) {
  return `chunk_${chunkX}_${chunkY}.png`;
}

function getAllChunkCoords(config) {
  const bounds = getWorldBoundsWorld();
  const minChunkX = Math.floor(bounds.minX / config.chunkSizePx);
  const maxChunkX = Math.ceil(bounds.maxX / config.chunkSizePx) - 1;
  const minChunkY = Math.floor(bounds.minY / config.chunkSizePx);
  const maxChunkY = Math.ceil(bounds.maxY / config.chunkSizePx) - 1;
  const coords = [];

  for (let y = minChunkY; y <= maxChunkY; y++) {
    for (let x = minChunkX; x <= maxChunkX; x++) {
      coords.push({ x, y });
    }
  }

  return {
    coords,
    minChunkX,
    minChunkY,
    maxChunkX,
    maxChunkY,
    chunkCols: maxChunkX - minChunkX + 1,
    chunkRows: maxChunkY - minChunkY + 1
  };
}

function getSpawnChunk(config) {
  const worldModel = new WorldModel(config.seed);
  const spawn = worldModel.getSpawnPoint();

  return {
    x: Math.floor(spawn.x / config.chunkSizePx),
    y: Math.floor(spawn.y / config.chunkSizePx)
  };
}

function selectCoords(args, config) {
  const all = getAllChunkCoords(config);

  if (args.all) return all;

  if (args.from && args.to) {
    const coords = [];
    const minX = Math.min(args.from.x, args.to.x);
    const maxX = Math.max(args.from.x, args.to.x);
    const minY = Math.min(args.from.y, args.to.y);
    const maxY = Math.max(args.from.y, args.to.y);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        coords.push({ x, y });
      }
    }

    return { ...all, coords };
  }

  const center = args.center === 'spawn' ? getSpawnChunk(config) : parseCoord(args.center);
  const radius = Math.max(0, Number(args.radius) || 0);
  const coords = [];

  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      coords.push({ x, y });
    }
  }

  coords.sort((a, b) => {
    const da = Math.abs(a.x - center.x) + Math.abs(a.y - center.y);
    const db = Math.abs(b.x - center.x) + Math.abs(b.y - center.y);
    return da - db;
  });

  return { ...all, coords };
}

async function readManifest(manifestPath) {
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = {
    ...organicTerrainConfig,
    cacheVersion: ORGANIC_BAKE_CONFIG.cacheVersion,
    imageFormat: ORGANIC_BAKE_CONFIG.imageFormat,
    imageQuality: ORGANIC_BAKE_CONFIG.imageQuality,
    chunkSizePx: ORGANIC_BAKE_CONFIG.chunkSizePx
  };
  const versionDir = path.join(rootDir, ORGANIC_BAKE_CONFIG.outputDir, ORGANIC_BAKE_CONFIG.cacheVersion);
  const chunksDir = path.join(versionDir, 'chunks');
  const manifestPath = path.join(versionDir, 'manifest.json');

  if (args.clear) {
    await rm(versionDir, { recursive: true, force: true });
    console.log(`[bake] Cache removido: ${versionDir}`);
    return;
  }

  await mkdir(chunksDir, { recursive: true });

  const configHash = createOrganicConfigHash(config);
  const existingManifest = await readManifest(manifestPath);
  const manifestValid = existingManifest?.configHash === configHash &&
    existingManifest?.version === ORGANIC_BAKE_CONFIG.cacheVersion;
  const selected = selectCoords(args, config);
  const field = new OrganicTerrainField(config);
  const manifest = manifestValid ? existingManifest : {
    version: ORGANIC_BAKE_CONFIG.cacheVersion,
    configHash,
    seed: config.seed,
    worldWidth: config.worldWidth,
    worldHeight: config.worldHeight,
    chunkSizePx: config.chunkSizePx,
    chunkCols: selected.chunkCols,
    chunkRows: selected.chunkRows,
    minChunkX: selected.minChunkX,
    minChunkY: selected.minChunkY,
    generatedAt: null,
    imageFormat: 'image/png',
    imageQuality: ORGANIC_BAKE_CONFIG.imageQuality,
    chunks: {}
  };

  let generated = 0;
  let skipped = 0;

  console.log(`[bake] versao=${manifest.version} hash=${configHash}`);
  console.log(`[bake] chunks selecionados=${selected.coords.length}`);

  for (let i = 0; i < selected.coords.length; i++) {
    const coord = selected.coords[i];
    const key = `${coord.x},${coord.y}`;
    const relativePath = `chunks/${chunkFileName(coord.x, coord.y)}`;
    const outPath = path.join(versionDir, relativePath);

    if (!args.force && manifestValid && manifest.chunks[key] && existsSync(outPath)) {
      skipped++;
    } else {
      const raster = renderOrganicChunkPixels({
        chunkX: coord.x,
        chunkY: coord.y,
        terrainField: field,
        config
      });
      await writeFile(outPath, encodePng(raster));
      generated++;
    }

    manifest.chunks[key] = relativePath;

    if ((i + 1) % 4 === 0 || i === selected.coords.length - 1) {
      console.log(`[bake] ${i + 1}/${selected.coords.length} gerados=${generated} pulados=${skipped}`);
    }
  }

  manifest.generatedAt = new Date().toISOString();
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`[bake] manifest: ${manifestPath}`);
  console.log(`[bake] concluido. gerados=${generated}, pulados=${skipped}`);
}

main().catch((error) => {
  console.error('[bake] falha:', error);
  process.exit(1);
});
