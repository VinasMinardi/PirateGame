import { organicTerrainConfig } from './organicTerrainConfig.js';
import { getOrganicTerrainHeightBiasAtWorld } from './OrganicTerrainOverrides.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function smoothstepRange(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  return smoothstep((value - edge0) / (edge1 - edge0));
}

function hash01(x, y, seed = 1) {
  let h = Math.imul(Math.floor(x) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul(Math.floor(y) ^ 0xc2b2ae35, 0x27d4eb2d);
  h ^= Math.imul(seed ^ 0x165667b1, 0x9e3779b1);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;

  return ((h >>> 0) % 100000) / 100000;
}

function noise2D(x, y, seed = 1) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const a = hash01(ix, iy, seed);
  const b = hash01(ix + 1, iy, seed);
  const c = hash01(ix, iy + 1, seed);
  const d = hash01(ix + 1, iy + 1, seed);
  const sx = smoothstep(fx);
  const sy = smoothstep(fy);
  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;

  return ab + (cd - ab) * sy;
}

function fbmNoise2D(x, y, {
  seed,
  octaves,
  lacunarity,
  gain
}) {
  let frequency = 1;
  let amplitude = 1;
  let total = 0;
  let amplitudeTotal = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise2D(x * frequency, y * frequency, seed + i * 1013) * amplitude;
    amplitudeTotal += amplitude;
    frequency *= lacunarity;
    amplitude *= gain;
  }

  return amplitudeTotal > 0 ? total / amplitudeTotal : 0;
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function lerpColor(a, b, t) {
  const amount = clamp(t, 0, 1);

  return {
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount
  };
}

function averageColors(colors) {
  const total = colors.reduce((acc, color) => ({
    r: acc.r + color.r,
    g: acc.g + color.g,
    b: acc.b + color.b
  }), { r: 0, g: 0, b: 0 });
  const count = Math.max(1, colors.length);

  return {
    r: total.r / count,
    g: total.g / count,
    b: total.b / count
  };
}

function adjustColor(rgb, amount) {
  return {
    r: rgb.r * (1 + amount),
    g: rgb.g * (1 + amount),
    b: rgb.b * (1 + amount)
  };
}

export const ORGANIC_TERRAIN_BANDS = [
  'deep_water',
  'shallow_water',
  'surf',
  'wet_sand',
  'beach',
  'land',
  'forest'
];

export class OrganicTerrainField {
  constructor(config = organicTerrainConfig) {
    this.config = config;
    this.seed = config.seed;
    this.colors = Object.fromEntries(
      Object.entries(config.colors).map(([key, value]) => [key, hexToRgb(value)])
    );
  }

  getHeightAtWorld(worldX, worldY) {
    const cfg = this.config;
    const warpX = (this.fbm(worldX, worldY, cfg.domainWarpScale, 2001) - 0.5) * cfg.domainWarpStrength;
    const warpY = (this.fbm(worldX + 913.7, worldY - 421.3, cfg.domainWarpScale, 3001) - 0.5) * cfg.domainWarpStrength;
    const x = worldX + warpX;
    const y = worldY + warpY;

    const continental = this.fbm(x, y, cfg.continentalScale, 11);
    const island = this.fbm(x, y, cfg.islandScale, 23);
    const medium = this.fbm(x, y, cfg.mediumScale, 37);
    const detail = this.fbm(x, y, cfg.detailScale, 53);
    const detailWeight = cfg.detailHeightWeight ?? 0.05;
    const broad = continental * 0.52 + island * 0.33 + medium * 0.10 + detail * detailWeight;
    const centered = (broad - cfg.seaLevel) * 1.65 + 0.50;

    const overrideBias = getOrganicTerrainHeightBiasAtWorld(worldX, worldY);
    return clamp(centered + overrideBias, 0, 1);
  }

  getTerrainBandAtHeight(height) {
    const t = this.config.thresholds;

    if (height < t.deepWater) return 'deep_water';
    if (height < t.shallowWater) return 'shallow_water';
    if (Number.isFinite(t.surf) && height < t.surf) return 'surf';
    if (height < t.wetSand) return 'wet_sand';
    if (height < t.beach) return 'beach';
    if (height < t.land) return 'land';
    return 'forest';
  }

  getTerrainSampleAtWorld(worldX, worldY, options = {}) {
    return this.sampleOrganicTerrainAtWorld(worldX, worldY, options);
  }

  sampleOrganicTerrainAtWorld(worldX, worldY) {
    const height = this.getHeightAtWorld(worldX, worldY);
    const visualLayer = this.getTerrainBandAtHeight(height);
    const detail = this.fbm(worldX, worldY, this.config.detailScale * 1.6, 8001) - 0.5;
    const color = adjustColor(
      this.getBlendedBandColor(height),
      detail * (this.config.detailColorStrength ?? 0.035)
    );

    return {
      height,
      visualLayer,
      color
    };
  }

  sampleOrganicTerrainCellAtWorld(worldX, worldY, cellSize, supersampling = 1) {
    const samplesPerAxis = Math.max(1, Math.floor(supersampling));
    const colors = [];
    const visualLayerCounts = {};
    let heightTotal = 0;

    for (let sy = 0; sy < samplesPerAxis; sy++) {
      for (let sx = 0; sx < samplesPerAxis; sx++) {
        const ox = (sx + 0.5) / samplesPerAxis;
        const oy = (sy + 0.5) / samplesPerAxis;
        const sample = this.sampleOrganicTerrainAtWorld(
          worldX + ox * cellSize,
          worldY + oy * cellSize
        );

        colors.push(sample.color);
        heightTotal += sample.height;
        visualLayerCounts[sample.visualLayer] = (visualLayerCounts[sample.visualLayer] ?? 0) + 1;
      }
    }

    let dominantVisualLayer = 'deep_water';
    let dominantCount = -1;

    for (const [visualLayer, count] of Object.entries(visualLayerCounts)) {
      if (count > dominantCount) {
        dominantVisualLayer = visualLayer;
        dominantCount = count;
      }
    }

    return {
      height: heightTotal / colors.length,
      visualLayer: dominantVisualLayer,
      color: averageColors(colors)
    };
  }

  getBlendedBandColor(height) {
    const t = this.config.thresholds;
    const blendWidth = this.config.bandBlendWidth ?? 0.035;

    if (!this.config.smoothBandEdges) {
      return this.getHardBandColor(height);
    }

    if (height < t.deepWater) {
      const amount = smoothstepRange(0, t.deepWater + blendWidth, height);
      return lerpColor(this.colors.deep_water_dark, this.colors.deep_water, amount);
    }

    if (height < t.shallowWater) {
      const amount = smoothstepRange(t.deepWater - blendWidth, t.shallowWater + blendWidth, height);
      return lerpColor(this.colors.deep_water, this.colors.shallow_water_light, amount);
    }

    if (height < t.wetSand) {
      const amount = smoothstepRange(t.shallowWater - blendWidth, t.wetSand + blendWidth, height);
      return lerpColor(this.colors.shallow_water_light, this.colors.wet_sand, amount);
    }

    if (height < t.beach) {
      const amount = smoothstepRange(t.wetSand - blendWidth, t.beach + blendWidth, height);
      return lerpColor(this.colors.wet_sand, this.colors.beach_light, amount);
    }

    if (height < t.land) {
      const amount = smoothstepRange(t.beach - blendWidth, t.land + blendWidth, height);
      return lerpColor(this.colors.beach_light, this.colors.forest, amount);
    }

    const amount = smoothstepRange(t.land - blendWidth, 1, height);
    return lerpColor(this.colors.forest, this.colors.forest_dark, amount);
  }

  getHardBandColor(height) {
    const t = this.config.thresholds;

    if (height < t.deepWater) return this.colors.deep_water;
    if (height < t.shallowWater) return this.colors.shallow_water;
    if (height < t.wetSand) return this.colors.wet_sand;
    if (height < t.beach) return this.colors.beach;
    if (height < t.land) return this.colors.land;
    return this.colors.forest;
  }

  fbm(worldX, worldY, scale, salt) {
    return fbmNoise2D(worldX * scale, worldY * scale, {
      seed: this.seed + salt,
      octaves: this.config.octaves,
      lacunarity: this.config.lacunarity,
      gain: this.config.gain
    });
  }
}

const defaultOrganicTerrainField = new OrganicTerrainField(organicTerrainConfig);

export function sampleOrganicTerrainAtWorld(worldX, worldY) {
  return defaultOrganicTerrainField.sampleOrganicTerrainAtWorld(worldX, worldY);
}

export { fbmNoise2D, noise2D };
