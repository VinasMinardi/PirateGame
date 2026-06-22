import { ORGANIC_TERRAIN_OVERRIDE_OPERATIONS } from './organicTerrainOverridesData.js';

const STORAGE_KEY = 'infinity.v3.organicTerrainOverrides.local.v1';
const CHANGE_EVENT = 'organic-terrain-overrides-changed';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep01(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
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

  const sx = smoothstep01(fx);
  const sy = smoothstep01(fy);

  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;

  return ab + (cd - ab) * sy;
}

function normalizeOperation(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const tool = raw.tool === 'raise_height' ||
    raw.tool === 'lower_height' ||
    raw.tool === 'erase_override'
    ? raw.tool
    : 'lower_height';

  const x = Number(raw.x);
  const y = Number(raw.y);
  const radius = Number(raw.radius);
  const strength = Number(raw.strength);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!Number.isFinite(radius) || radius <= 0) return null;

  return {
    id: String(raw.id ?? `op_${Date.now()}_${Math.floor(Math.random() * 100000)}`),
    tool,
    x,
    y,
    radius: clamp(radius, 64, 20000),
    strength: clamp(Number.isFinite(strength) ? strength : 0.10, 0, 0.45),
    noise: clamp(Number(raw.noise ?? 0.25), 0, 1),
    falloff: 'smooth',
    createdAt: Number(raw.createdAt ?? Date.now()),
    source: raw.source ?? 'runtime'
  };
}

function loadLocalOperations() {
  if (typeof localStorage === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeOperation)
      .filter(Boolean)
      .map((op) => ({ ...op, source: 'local' }));
  } catch (error) {
    console.warn('[OrganicTerrainOverrides] Falha ao carregar overrides locais:', error);
    return [];
  }
}

function saveLocalOperations(localOperations) {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localOperations));
  } catch (error) {
    console.warn('[OrganicTerrainOverrides] Falha ao salvar overrides locais:', error);
  }
}

const staticOperations = ORGANIC_TERRAIN_OVERRIDE_OPERATIONS
  .map(normalizeOperation)
  .filter(Boolean)
  .map((op) => ({ ...op, source: 'static' }));

let localOperations = loadLocalOperations();
let operations = [...staticOperations, ...localOperations];

function emitChange(detail = {}) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
    detail: {
      operations: operations.length,
      localOperations: localOperations.length,
      staticOperations: staticOperations.length,
      ...detail
    }
  }));
}

function operationInfluence(operation, worldX, worldY) {
  const dx = worldX - operation.x;
  const dy = worldY - operation.y;
  const distance = Math.hypot(dx, dy);

  if (distance > operation.radius * 1.35) return 0;

  const edgeNoise =
    (noise2D(worldX * 0.0015, worldY * 0.0015, operation.createdAt % 100000) - 0.5) *
    2 *
    operation.noise *
    0.22;

  const normalized = distance / operation.radius - edgeNoise;

  if (normalized >= 1) return 0;

  return 1 - smoothstep01(normalized);
}

export function getOrganicTerrainOverrideOperations() {
  return operations.slice();
}

export function getOrganicTerrainHeightBiasAtWorld(worldX, worldY) {
  if (!operations.length) return 0;

  let bias = 0;

  for (const operation of operations) {
    if (operation.tool === 'erase_override') continue;

    const influence = operationInfluence(operation, worldX, worldY);
    if (influence <= 0) continue;

    if (operation.tool === 'raise_height') {
      bias += operation.strength * influence;
    } else if (operation.tool === 'lower_height') {
      bias -= operation.strength * influence;
    }
  }

  return clamp(bias, -0.65, 0.65);
}

export function addOrganicTerrainOverrideOperation(rawOperation) {
  const operation = normalizeOperation({
    ...rawOperation,
    id: rawOperation?.id ?? `op_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    createdAt: rawOperation?.createdAt ?? Date.now(),
    source: 'local'
  });

  if (!operation) return null;

  if (operation.tool === 'erase_override') {
    eraseOrganicTerrainOverridesAt(operation.x, operation.y, operation.radius);
    return operation;
  }

  localOperations.push({ ...operation, source: 'local' });
  operations = [...staticOperations, ...localOperations];
  saveLocalOperations(localOperations);
  emitChange(operation);

  return operation;
}

export function undoLastOrganicTerrainOverrideOperation() {
  const removed = localOperations.pop() ?? null;
  operations = [...staticOperations, ...localOperations];
  saveLocalOperations(localOperations);

  emitChange({
    tool: 'undo',
    x: removed?.x,
    y: removed?.y,
    radius: removed?.radius
  });

  return removed;
}

export function eraseOrganicTerrainOverridesAt(x, y, radius) {
  const before = localOperations.length;

  localOperations = localOperations.filter((operation) => {
    const distance = Math.hypot(operation.x - x, operation.y - y);
    return distance > radius + operation.radius * 0.35;
  });

  operations = [...staticOperations, ...localOperations];
  saveLocalOperations(localOperations);

  emitChange({
    tool: 'erase_override',
    x,
    y,
    radius,
    erased: before - localOperations.length
  });

  return before - localOperations.length;
}

export function clearOrganicTerrainOverrideOperations() {
  localOperations = [];
  operations = [...staticOperations];

  saveLocalOperations(localOperations);
  emitChange({ tool: 'clear_all' });
}

export function getOrganicTerrainOverridesHash() {
  const payload = JSON.stringify(operations.map((operation) => ({
    tool: operation.tool,
    x: Math.round(operation.x),
    y: Math.round(operation.y),
    radius: Math.round(operation.radius),
    strength: Number(operation.strength.toFixed(4)),
    noise: Number(operation.noise.toFixed(4)),
    createdAt: operation.createdAt
  })));

  let h = 2166136261;

  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return (h >>> 0).toString(16);
}

export function exportOrganicTerrainOverridesModule() {
  const body = JSON.stringify(localOperations.map((operation) => ({
    id: operation.id,
    tool: operation.tool,
    x: Math.round(operation.x * 100) / 100,
    y: Math.round(operation.y * 100) / 100,
    radius: Math.round(operation.radius * 100) / 100,
    strength: Math.round(operation.strength * 10000) / 10000,
    noise: Math.round(operation.noise * 10000) / 10000,
    falloff: 'smooth',
    createdAt: operation.createdAt
  })), null, 2);

  return `export const ORGANIC_TERRAIN_OVERRIDE_OPERATIONS = ${body};\n`;
}

export function installOrganicTerrainOverridesDebugApi() {
  if (typeof window === 'undefined') return;

  window.infinityDebug = window.infinityDebug ?? {};
  window.infinityDebug.organicTerrainOverrides = {
    list: getOrganicTerrainOverrideOperations,
    add: addOrganicTerrainOverrideOperation,
    undo: undoLastOrganicTerrainOverrideOperation,
    clear: clearOrganicTerrainOverrideOperations,
    eraseAt: eraseOrganicTerrainOverridesAt,
    exportModule: exportOrganicTerrainOverridesModule,
    hash: getOrganicTerrainOverridesHash
  };
}

installOrganicTerrainOverridesDebugApi();
