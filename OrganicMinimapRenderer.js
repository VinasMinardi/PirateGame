import {
  getSectorAtWorld
} from '../../../shared/world/SectorGrid.js';

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export class OrganicMinimapRenderer {
  constructor(field, options = {}) {
    this.field = field;
    this.size = options.size ?? 220;
    this.sampleStep = options.sampleStep ?? 1;

    this.canvas = null;
    this.ctx = null;

    this.baseCanvas = document.createElement('canvas');
    this.baseCanvas.width = this.size;
    this.baseCanvas.height = this.size;
    this.baseCtx = this.baseCanvas.getContext('2d');

    this.cachedSectorCanvases = new Map();
    this.currentSector = null;
    this.ready = false;

    this.bindOverrideEvents();

    this.metrics = {
      ready: false,
      buildMs: 0,
      size: this.size,
      mode: 'sector',
      currentSector: '-',
      cachedSectors: 0
    };
  }

  bindOverrideEvents() {
    if (typeof window === 'undefined') return;

    window.addEventListener('organic-terrain-overrides-changed', () => {
      if (!this.currentSector) {
        this.ready = false;
        return;
      }

      this.ready = false;
      this.renderSector(this.currentSector, { force: true }).catch((error) => {
        console.warn('[OrganicMinimapRenderer] Falha ao atualizar minimapa apos override:', error);
      });
    });
  }

  attach(canvas) {
    this.canvas = canvas;
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;

    this.drawEmpty('Aguardando setor');
  }

  async prewarm(options = {}) {
    const worldX = Number.isFinite(options.worldX) ? options.worldX : 0;
    const worldY = Number.isFinite(options.worldY) ? options.worldY : 0;
    const sector = getSectorAtWorld(worldX, worldY);

    if (!sector?.isInside || !sector.boundsWorld) {
      this.ready = true;
      this.metrics.ready = true;
      return;
    }

    await this.buildSectorCanvas(sector, {
      onProgress: options.onProgress,
      yieldEveryRows: options.yieldEveryRows ?? 24
    });

    this.currentSector = sector;
    this.copyCachedSectorToBase(sector.id);
    this.ready = true;
    this.metrics.ready = true;
    this.metrics.currentSector = sector.id;

    if (this.ctx) {
      this.ctx.drawImage(this.baseCanvas, 0, 0);
    }
  }

  update(localShip) {
    if (!this.ctx || !localShip) return;

    const sector = getSectorAtWorld(localShip.x, localShip.y);

    if (!sector?.isInside || !sector.boundsWorld) {
      this.drawEmpty('FORA');
      return;
    }

    if (!this.currentSector || this.currentSector.id !== sector.id) {
      this.currentSector = sector;

      if (this.cachedSectorCanvases.has(sector.id)) {
        this.copyCachedSectorToBase(sector.id);
      } else {
        // O minimapa de setor e pequeno. Gerar sincrono na troca de setor e aceitavel
        // e evita que o usuario fique sem referencia visual.
        this.buildSectorCanvasSync(sector);
        this.copyCachedSectorToBase(sector.id);
      }

      this.ready = true;
      this.metrics.ready = true;
      this.metrics.currentSector = sector.id;
    }

    this.ctx.clearRect(0, 0, this.size, this.size);
    this.ctx.drawImage(this.baseCanvas, 0, 0);

    this.drawShipMarker(localShip, sector);
    this.drawCurrentSectorLabel(sector);
  }

  async buildSectorCanvas(sector, options = {}) {
    const onProgress = options.onProgress ?? null;
    const yieldEveryRows = Math.max(1, options.yieldEveryRows ?? 24);
    const start = performance.now();

    const canvas = document.createElement('canvas');
    canvas.width = this.size;
    canvas.height = this.size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(this.size, this.size);
    const data = image.data;

    for (let y = 0; y < this.size; y += this.sampleStep) {
      this.fillSectorRow(data, sector, y);

      if (onProgress) {
        onProgress((y + 1) / this.size);
      }

      if (y % yieldEveryRows === 0) {
        await nextFrame();
      }
    }

    ctx.putImageData(image, 0, 0);
    this.drawSectorFrame(ctx, sector);

    this.cachedSectorCanvases.set(sector.id, canvas);
    this.metrics.cachedSectors = this.cachedSectorCanvases.size;
    this.metrics.buildMs = performance.now() - start;
  }

  buildSectorCanvasSync(sector) {
    const start = performance.now();

    const canvas = document.createElement('canvas');
    canvas.width = this.size;
    canvas.height = this.size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(this.size, this.size);
    const data = image.data;

    for (let y = 0; y < this.size; y += this.sampleStep) {
      this.fillSectorRow(data, sector, y);
    }

    ctx.putImageData(image, 0, 0);
    this.drawSectorFrame(ctx, sector);

    this.cachedSectorCanvases.set(sector.id, canvas);
    this.metrics.cachedSectors = this.cachedSectorCanvases.size;
    this.metrics.buildMs = performance.now() - start;
  }

  fillSectorRow(data, sector, y) {
    for (let x = 0; x < this.size; x += this.sampleStep) {
      const world = this.minimapToWorldInSector(x + 0.5, y + 0.5, sector.boundsWorld);
      const sample = this.field.sampleOrganicTerrainAtWorld(world.x, world.y);
      const r = clamp255(sample.color.r);
      const g = clamp255(sample.color.g);
      const b = clamp255(sample.color.b);

      for (let py = 0; py < this.sampleStep; py++) {
        for (let px = 0; px < this.sampleStep; px++) {
          const ix = x + px;
          const iy = y + py;

          if (ix >= this.size || iy >= this.size) continue;

          const index = (iy * this.size + ix) * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        }
      }
    }
  }

  copyCachedSectorToBase(sectorId) {
    const canvas = this.cachedSectorCanvases.get(sectorId);

    if (!canvas) return;

    this.baseCtx.clearRect(0, 0, this.size, this.size);
    this.baseCtx.drawImage(canvas, 0, 0);
  }

  minimapToWorldInSector(x, y, sectorBounds) {
    return {
      x: sectorBounds.minX + (x / this.size) * sectorBounds.width,
      y: sectorBounds.minY + (y / this.size) * sectorBounds.height
    };
  }

  worldToMinimapInSector(worldX, worldY, sectorBounds) {
    return {
      x: ((worldX - sectorBounds.minX) / sectorBounds.width) * this.size,
      y: ((worldY - sectorBounds.minY) / sectorBounds.height) * this.size
    };
  }

  drawSectorFrame(ctx, sector) {
    ctx.save();

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.68)';
    ctx.lineWidth = 6;
    ctx.strokeRect(2, 2, this.size - 4, this.size - 4);

    ctx.strokeStyle = 'rgba(241, 212, 138, 0.92)';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, this.size - 6, this.size - 6);

    // Referencia visual discreta dentro do setor, para dar escala sem confundir
    // com divisao real de setores.
    ctx.strokeStyle = 'rgba(255, 248, 220, 0.16)';
    ctx.lineWidth = 1;

    for (let i = 1; i < 4; i++) {
      const p = (this.size / 4) * i;

      ctx.beginPath();
      ctx.moveTo(p, 4);
      ctx.lineTo(p, this.size - 4);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(4, p);
      ctx.lineTo(this.size - 4, p);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawShipMarker(localShip, sector) {
    const pos = this.worldToMinimapInSector(localShip.x, localShip.y, sector.boundsWorld);
    const rotation = localShip.r ?? localShip.rotation ?? 0;

    this.ctx.save();
    this.ctx.translate(pos.x, pos.y);
    this.ctx.rotate(rotation);

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
    this.ctx.lineWidth = 2;

    this.ctx.fillStyle = '#ff3b30';
    this.ctx.beginPath();
    this.ctx.moveTo(10, 0);
    this.ctx.lineTo(-6, -5);
    this.ctx.lineTo(-3, 0);
    this.ctx.lineTo(-6, 5);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawCurrentSectorLabel(sector) {
    this.ctx.save();

    this.ctx.fillStyle = 'rgba(8, 10, 14, 0.78)';
    this.ctx.fillRect(6, 6, 48, 24);

    this.ctx.strokeStyle = 'rgba(241, 212, 138, 0.9)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(6.5, 6.5, 47, 23);

    this.ctx.fillStyle = '#fff8dc';
    this.ctx.font = 'bold 14px Georgia';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(sector.id, 30, 18);

    this.ctx.restore();
  }

  drawEmpty(label = '-') {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.fillStyle = '#050b12';
    this.ctx.fillRect(0, 0, this.size, this.size);
    this.ctx.strokeStyle = 'rgba(241, 212, 138, 0.75)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(2, 2, this.size - 4, this.size - 4);
    this.ctx.fillStyle = '#fff8dc';
    this.ctx.font = 'bold 13px Georgia';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, this.size / 2, this.size / 2);
    this.ctx.restore();
  }
}
