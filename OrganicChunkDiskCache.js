import {
  ORGANIC_CACHE_CONFIG,
  organicTerrainConfig
} from './organicTerrainConfig.js';

const DB_NAME = 'InfinityOrganicMapCache';
const STORE_NAME = 'chunks';
const DB_VERSION = 1;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(',')}}`;
}

export function hashString(value) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function createOrganicConfigHash(config = organicTerrainConfig) {
  return hashString(stableStringify({
    seed: config.seed,
    worldWidth: config.worldWidth,
    worldHeight: config.worldHeight,
    chunkSizePx: config.chunkSizePx,
    visualCellSize: config.visualCellSize,
    supersampling: config.supersampling,
    smoothBandEdges: config.smoothBandEdges,
    bandBlendWidth: config.bandBlendWidth,
    continentalScale: config.continentalScale,
    islandScale: config.islandScale,
    mediumScale: config.mediumScale,
    detailScale: config.detailScale,
    detailHeightWeight: config.detailHeightWeight,
    detailColorStrength: config.detailColorStrength,
    octaves: config.octaves,
    lacunarity: config.lacunarity,
    gain: config.gain,
    domainWarpStrength: config.domainWarpStrength,
    domainWarpScale: config.domainWarpScale,
    seaLevel: config.seaLevel,
    thresholds: config.thresholds,
    colors: config.colors
  }));
}

export function getOrganicChunkCacheKey(chunkX, chunkY, config = organicTerrainConfig) {
  const version = config.cacheVersion ?? ORGANIC_CACHE_CONFIG.cacheVersion;
  const configHash = createOrganicConfigHash(config);

  return [
    version,
    `seed${config.seed}`,
    `world${config.worldWidth}x${config.worldHeight}`,
    `cs${config.chunkSizePx}`,
    `cell${config.visualCellSize}`,
    `ss${config.supersampling}`,
    `hash${configHash}`,
    `chunk_${chunkX}_${chunkY}`
  ].join('_');
}

export class OrganicChunkDiskCache {
  constructor(config = organicTerrainConfig, options = {}) {
    this.config = config;
    this.cacheConfig = {
      ...ORGANIC_CACHE_CONFIG,
      ...options
    };
    this.cacheVersion = config.cacheVersion ?? this.cacheConfig.cacheVersion;
    this.configHash = createOrganicConfigHash(config);
    this.db = null;
    this.enabled = !!this.cacheConfig.persistentCacheEnabled;
    this.ready = false;
    this.persisted = false;
    this.metrics = {
      enabled: this.enabled,
      ready: false,
      hits: 0,
      misses: 0,
      writes: 0,
      errors: 0,
      prunedChunks: 0,
      estimatedUsage: 0,
      estimatedQuota: 0,
      persisted: false,
      configHash: this.configHash,
      cacheVersion: this.cacheVersion
    };
  }

  async open() {
    if (!this.enabled || typeof indexedDB === 'undefined') {
      this.enabled = false;
      this.metrics.enabled = false;
      return false;
    }

    try {
      if (
        this.cacheConfig.requestPersistentStorage &&
        typeof navigator !== 'undefined' &&
        navigator.storage?.persist
      ) {
        this.persisted = await navigator.storage.persist();
        this.metrics.persisted = this.persisted;
      }

      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          const store = db.objectStoreNames.contains(STORE_NAME)
            ? request.transaction.objectStore(STORE_NAME)
            : db.createObjectStore(STORE_NAME, { keyPath: 'key' });

          if (!store.indexNames.contains('lastAccessedAt')) {
            store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      this.ready = true;
      this.metrics.ready = true;

      if (this.cacheConfig.pruneOnStartup) {
        await this.pruneCache();
      }

      await this.estimateUsage();
      return true;
    } catch (error) {
      console.warn('[OrganicChunkDiskCache] IndexedDB indisponivel:', error);
      this.metrics.errors++;
      this.enabled = false;
      this.ready = false;
      this.metrics.enabled = false;
      this.metrics.ready = false;
      return false;
    }
  }

  getKey(chunkX, chunkY) {
    return getOrganicChunkCacheKey(chunkX, chunkY, this.config);
  }

  async getChunkBlob(cacheKey) {
    if (!this.ready) return null;

    try {
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const record = await requestToPromise(store.get(cacheKey));

      if (!record || record.cacheVersion !== this.cacheVersion || record.configHash !== this.configHash) {
        this.metrics.misses++;
        return null;
      }

      record.lastAccessedAt = Date.now();
      store.put(record);
      await transactionComplete(transaction);
      this.metrics.hits++;
      return record.blob ?? null;
    } catch (error) {
      console.warn('[OrganicChunkDiskCache] Falha ao ler chunk:', error);
      this.metrics.errors++;
      return null;
    }
  }

  async putChunkBlob(cacheKey, blob, metadata = {}) {
    if (!this.ready || !blob) return false;

    try {
      const now = Date.now();
      const record = {
        key: cacheKey,
        blob,
        createdAt: now,
        lastAccessedAt: now,
        sizeBytes: blob.size ?? 0,
        seed: this.config.seed,
        cacheVersion: this.cacheVersion,
        configHash: this.configHash,
        ...metadata
      };
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(record);
      await transactionComplete(transaction);
      this.metrics.writes++;
      return true;
    } catch (error) {
      console.warn('[OrganicChunkDiskCache] Falha ao salvar chunk:', error);
      this.metrics.errors++;
      return false;
    }
  }

  async deleteChunk(cacheKey) {
    if (!this.ready) return false;

    try {
      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(cacheKey);
      await transactionComplete(transaction);
      return true;
    } catch (error) {
      this.metrics.errors++;
      return false;
    }
  }

  async getAllRecords() {
    if (!this.ready) return [];

    const transaction = this.db.transaction(STORE_NAME, 'readonly');
    const records = await requestToPromise(transaction.objectStore(STORE_NAME).getAll());
    await transactionComplete(transaction);
    return records;
  }

  async pruneCache() {
    if (!this.ready) return;

    try {
      const records = await this.getAllRecords();
      const stale = records.filter((record) => (
        record.cacheVersion !== this.cacheVersion ||
        record.configHash !== this.configHash
      ));
      const current = records.filter((record) => !stale.includes(record));
      let currentBytes = current.reduce((sum, record) => sum + (record.sizeBytes ?? record.blob?.size ?? 0), 0);
      const toDelete = [...stale];

      current.sort((a, b) => (a.lastAccessedAt ?? 0) - (b.lastAccessedAt ?? 0));

      while (current.length > this.cacheConfig.maxPersistentChunks) {
        toDelete.push(current.shift());
      }

      while (currentBytes > this.cacheConfig.maxPersistentBytes && current.length) {
        const record = current.shift();
        currentBytes -= record.sizeBytes ?? record.blob?.size ?? 0;
        toDelete.push(record);
      }

      if (!toDelete.length) return;

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      for (const record of toDelete) {
        store.delete(record.key);
      }

      await transactionComplete(transaction);
      this.metrics.prunedChunks += toDelete.length;
    } catch (error) {
      console.warn('[OrganicChunkDiskCache] Falha no prune:', error);
      this.metrics.errors++;
    }
  }

  async clearCurrentVersion() {
    if (!this.ready) return;

    const records = await this.getAllRecords();
    const transaction = this.db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    for (const record of records) {
      if (record.cacheVersion === this.cacheVersion && record.configHash === this.configHash) {
        store.delete(record.key);
      }
    }

    await transactionComplete(transaction);
  }

  async clearAll() {
    if (!this.ready) return;

    const transaction = this.db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    await transactionComplete(transaction);
  }

  async estimateUsage() {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        this.metrics.estimatedUsage = estimate.usage ?? 0;
        this.metrics.estimatedQuota = estimate.quota ?? 0;
      }
    } catch (error) {
      this.metrics.errors++;
    }

    return {
      usage: this.metrics.estimatedUsage,
      quota: this.metrics.estimatedQuota
    };
  }
}
