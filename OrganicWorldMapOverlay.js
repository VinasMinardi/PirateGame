import { sectorConfig } from '../../../shared/config/sectorConfig.js';
import {
  getWorldBoundsWorld,
  getSectorAtWorld
} from '../../../shared/world/SectorGrid.js';

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function isTypingTarget(target) {
  const tag = String(target?.tagName ?? '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || target?.isContentEditable;
}

export class OrganicWorldMapOverlay {
  constructor(field, options = {}) {
    this.field = field;

    this.size = options.size ?? 800;
    this.sampleStep = options.sampleStep ?? 2;

    this.worldBounds = getWorldBoundsWorld();

    this.visible = false;
    this.ready = false;
    this.building = false;
    this.localShip = null;
    this.progress = 0;

    this.zoom = 1;
    this.minZoom = 1;
    this.maxZoom = options.maxZoom ?? 8;
    this.viewCenter = {
      x: this.size / 2,
      y: this.size / 2
    };

    this.isPanning = false;
    this.panStart = null;

    this.baseCanvas = document.createElement('canvas');
    this.baseCanvas.width = this.size;
    this.baseCanvas.height = this.size;
    this.baseCtx = this.baseCanvas.getContext('2d', { willReadFrequently: false });

    this.overlay = null;
    this.panel = null;
    this.canvas = null;
    this.ctx = null;
    this.status = null;
    this.footer = null;
    this.zoomLabel = null;

    this.metrics = {
      ready: false,
      buildMs: 0,
      size: this.size,
      sampleStep: this.sampleStep,
      progress: 0,
      zoom: 1
    };

    this.createDom();
    this.bindKeys();
    this.bindOverrideEvents();

    // API usada pelo editor orgânico para converter clique em coordenada global,
    // já respeitando zoom/pan do mapa mundi.
    window.infinityWorldMapOverlay = this;
  }

  createDom() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'organic-world-map-overlay';
    Object.assign(this.overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.72)',
      userSelect: 'none'
    });

    this.panel = document.createElement('div');
    Object.assign(this.panel.style, {
      position: 'relative',
      padding: '14px',
      border: '2px solid rgba(241, 212, 138, 0.92)',
      background: 'rgba(5, 8, 14, 0.94)',
      boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
      borderRadius: '10px'
    });

    const title = document.createElement('div');
    title.textContent = 'Mapa Mundi';
    Object.assign(title.style, {
      color: '#fff8dc',
      font: 'bold 20px Georgia, serif',
      letterSpacing: '0.5px',
      marginBottom: '8px',
      textAlign: 'center'
    });

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    Object.assign(this.canvas.style, {
      width: `${this.size}px`,
      height: `${this.size}px`,
      maxWidth: 'min(86vw, 900px)',
      maxHeight: 'min(82vh, 900px)',
      display: 'block',
      border: '1px solid rgba(255,255,255,0.22)',
      background: '#07101a',
      imageRendering: 'auto',
      cursor: 'crosshair'
    });

    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });

    this.status = document.createElement('div');
    Object.assign(this.status.style, {
      position: 'absolute',
      left: '24px',
      top: '54px',
      padding: '6px 10px',
      color: '#fff8dc',
      background: 'rgba(0,0,0,0.60)',
      border: '1px solid rgba(241,212,138,0.45)',
      borderRadius: '6px',
      font: '13px Georgia, serif',
      pointerEvents: 'none'
    });
    this.status.textContent = 'Setor atual: - | M/Esc fecha';

    const zoomControls = document.createElement('div');
    Object.assign(zoomControls.style, {
      position: 'absolute',
      right: '24px',
      top: '54px',
      display: 'grid',
      gridTemplateColumns: '34px 34px 64px',
      gap: '5px',
      alignItems: 'center',
      color: '#fff8dc',
      background: 'rgba(0,0,0,0.55)',
      border: '1px solid rgba(241,212,138,0.45)',
      borderRadius: '7px',
      padding: '5px',
      font: '12px Georgia, serif'
    });

    const zoomOut = this.createZoomButton('−', () => this.zoomAtCenter(1 / 1.35));
    const zoomIn = this.createZoomButton('+', () => this.zoomAtCenter(1.35));

    this.zoomLabel = document.createElement('button');
    this.zoomLabel.type = 'button';
    this.zoomLabel.textContent = '100%';
    Object.assign(this.zoomLabel.style, {
      color: '#fff8dc',
      background: 'rgba(20,26,34,0.96)',
      border: '1px solid rgba(241,212,138,0.55)',
      borderRadius: '5px',
      padding: '6px 7px',
      cursor: 'pointer',
      font: 'bold 12px Georgia, serif'
    });
    this.zoomLabel.title = 'Resetar zoom';
    this.zoomLabel.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.resetZoom();
    });

    zoomControls.appendChild(zoomOut);
    zoomControls.appendChild(zoomIn);
    zoomControls.appendChild(this.zoomLabel);

    this.footer = document.createElement('div');
    this.footer.textContent = 'M / Esc: fechar  |  roda do mouse: zoom  |  botão direito/meio: arrastar  |  O: editor';
    Object.assign(this.footer.style, {
      color: 'rgba(255,248,220,0.82)',
      font: '12px Georgia, serif',
      marginTop: '8px',
      textAlign: 'center'
    });

    this.panel.appendChild(title);
    this.panel.appendChild(this.canvas);
    this.panel.appendChild(this.status);
    this.panel.appendChild(zoomControls);
    this.panel.appendChild(this.footer);
    this.overlay.appendChild(this.panel);
    document.body.appendChild(this.overlay);

    this.bindPointerEvents();
    this.drawLoading('Mapa ainda não gerado');
  }

  createZoomButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    Object.assign(button.style, {
      color: '#fff8dc',
      background: 'rgba(20,26,34,0.96)',
      border: '1px solid rgba(241,212,138,0.55)',
      borderRadius: '5px',
      padding: '6px 8px',
      cursor: 'pointer',
      font: 'bold 15px Georgia, serif'
    });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  bindKeys() {
    window.addEventListener('keydown', (event) => {
      if (isTypingTarget(event.target)) return;

      const key = String(event.key ?? '').toLowerCase();

      if (key === 'm') {
        event.preventDefault();
        this.toggle();
      }

      if (key === 'escape' && this.visible) {
        event.preventDefault();
        this.hide();
      }

      if (!this.visible) return;

      if (key === '+' || key === '=') {
        event.preventDefault();
        this.zoomAtCenter(1.25);
      }

      if (key === '-' || key === '_') {
        event.preventDefault();
        this.zoomAtCenter(1 / 1.25);
      }

      if (key === '0') {
        event.preventDefault();
        this.resetZoom();
      }
    });
  }

  bindOverrideEvents() {
    window.addEventListener('organic-terrain-overrides-changed', () => {
      this.ready = false;
      this.progress = 0;

      if (this.visible && !this.building) {
        this.buildWorldMap().then(() => this.redraw());
      }
    });
  }

  bindPointerEvents() {
    this.canvas.addEventListener('wheel', (event) => {
      if (!this.visible) return;

      event.preventDefault();
      event.stopPropagation();

      const factor = event.deltaY < 0 ? 1.22 : 1 / 1.22;
      this.zoomAtClientPoint(event.clientX, event.clientY, factor);
    }, { passive: false });

    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    this.canvas.addEventListener('pointerdown', (event) => {
      // Botão direito ou meio: arrasta o mapa quando estiver com zoom.
      if (event.button !== 1 && event.button !== 2) return;

      event.preventDefault();
      event.stopPropagation();

      this.isPanning = true;
      this.canvas.setPointerCapture?.(event.pointerId);
      this.panStart = {
        clientX: event.clientX,
        clientY: event.clientY,
        centerX: this.viewCenter.x,
        centerY: this.viewCenter.y
      };
      this.canvas.style.cursor = 'grabbing';
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.isPanning || !this.panStart) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = this.canvas.getBoundingClientRect();
      const dxCanvas = ((event.clientX - this.panStart.clientX) / rect.width) * this.size;
      const dyCanvas = ((event.clientY - this.panStart.clientY) / rect.height) * this.size;

      this.viewCenter.x = this.panStart.centerX - dxCanvas / this.zoom;
      this.viewCenter.y = this.panStart.centerY - dyCanvas / this.zoom;
      this.clampViewCenter();
      this.redraw();
    });

    const endPan = (event) => {
      if (!this.isPanning) return;

      event?.preventDefault?.();
      event?.stopPropagation?.();

      this.isPanning = false;
      this.panStart = null;
      this.canvas.style.cursor = 'crosshair';
    };

    this.canvas.addEventListener('pointerup', endPan);
    this.canvas.addEventListener('pointercancel', endPan);
    this.canvas.addEventListener('pointerleave', endPan);
  }

  async toggle() {
    if (this.visible) {
      this.hide();
      return;
    }

    this.show();

    if (!this.ready && !this.building) {
      await this.buildWorldMap();
      this.redraw();
    }
  }

  show() {
    this.visible = true;
    this.overlay.style.display = 'flex';

    if (this.ready) {
      this.redraw();
    } else {
      this.drawLoading(this.building ? 'Gerando mapa mundi...' : 'Preparando mapa mundi...');
    }
  }

  hide() {
    this.visible = false;
    this.overlay.style.display = 'none';
  }

  update(localShip) {
    this.localShip = localShip ?? this.localShip;

    if (!this.visible || !this.ready) return;

    this.redraw();
  }

  async buildWorldMap(options = {}) {
    if (this.building || this.ready) return;

    this.building = true;
    this.progress = 0;
    this.metrics.progress = 0;

    const start = performance.now();
    const size = this.size;
    const step = Math.max(1, options.sampleStep ?? this.sampleStep);
    const yieldEveryRows = Math.max(1, options.yieldEveryRows ?? 16);
    const image = this.baseCtx.createImageData(size, size);
    const data = image.data;

    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const world = this.mapToWorld(x + 0.5, y + 0.5);
        const sample = this.field.sampleOrganicTerrainAtWorld(world.x, world.y);
        const r = clamp255(sample.color.r);
        const g = clamp255(sample.color.g);
        const b = clamp255(sample.color.b);

        for (let py = 0; py < step; py++) {
          for (let px = 0; px < step; px++) {
            const ix = x + px;
            const iy = y + py;

            if (ix >= size || iy >= size) continue;

            const index = (iy * size + ix) * 4;
            data[index] = r;
            data[index + 1] = g;
            data[index + 2] = b;
            data[index + 3] = 255;
          }
        }
      }

      this.progress = Math.min(1, (y + step) / size);
      this.metrics.progress = this.progress;

      if (this.visible) {
        this.drawLoading(`Gerando mapa mundi... ${Math.round(this.progress * 100)}%`);
      }

      if (y % yieldEveryRows === 0) {
        await nextFrame();
      }
    }

    this.baseCtx.putImageData(image, 0, 0);
    this.drawSectorGridOnBase();

    this.ready = true;
    this.building = false;
    this.metrics.ready = true;
    this.metrics.buildMs = performance.now() - start;
    this.metrics.progress = 1;

    this.centerOnShipIfPossible();
  }

  centerOnShipIfPossible() {
    if (!this.localShip) return;

    const pos = this.worldToMap(this.localShip.x, this.localShip.y);
    this.viewCenter.x = pos.x;
    this.viewCenter.y = pos.y;
    this.clampViewCenter();
  }

  mapToWorld(mapX, mapY) {
    return {
      x: this.worldBounds.minX + (mapX / this.size) * this.worldBounds.width,
      y: this.worldBounds.minY + (mapY / this.size) * this.worldBounds.height
    };
  }

  worldToMap(worldX, worldY) {
    return {
      x: ((worldX - this.worldBounds.minX) / this.worldBounds.width) * this.size,
      y: ((worldY - this.worldBounds.minY) / this.worldBounds.height) * this.size
    };
  }

  getViewSourceRect() {
    const sourceW = this.size / this.zoom;
    const sourceH = this.size / this.zoom;

    const sx = clamp(this.viewCenter.x - sourceW / 2, 0, this.size - sourceW);
    const sy = clamp(this.viewCenter.y - sourceH / 2, 0, this.size - sourceH);

    return { sx, sy, sw: sourceW, sh: sourceH };
  }

  clampViewCenter() {
    const sourceW = this.size / this.zoom;
    const sourceH = this.size / this.zoom;

    this.viewCenter.x = clamp(this.viewCenter.x, sourceW / 2, this.size - sourceW / 2);
    this.viewCenter.y = clamp(this.viewCenter.y, sourceH / 2, this.size - sourceH / 2);
  }

  clientToCanvas(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();

    return {
      x: ((clientX - rect.left) / rect.width) * this.size,
      y: ((clientY - rect.top) / rect.height) * this.size
    };
  }

  clientToMap(clientX, clientY) {
    const canvas = this.clientToCanvas(clientX, clientY);
    const view = this.getViewSourceRect();

    return {
      x: view.sx + canvas.x / this.zoom,
      y: view.sy + canvas.y / this.zoom
    };
  }

  clientToWorld(clientX, clientY) {
    const map = this.clientToMap(clientX, clientY);
    return this.mapToWorld(map.x, map.y);
  }

  worldToCanvas(worldX, worldY) {
    const map = this.worldToMap(worldX, worldY);
    const view = this.getViewSourceRect();

    return {
      x: (map.x - view.sx) * this.zoom,
      y: (map.y - view.sy) * this.zoom
    };
  }

  zoomAtCenter(factor) {
    this.setZoom(this.zoom * factor, this.viewCenter.x, this.viewCenter.y);
  }

  zoomAtClientPoint(clientX, clientY, factor) {
    const before = this.clientToMap(clientX, clientY);
    const canvas = this.clientToCanvas(clientX, clientY);
    const nextZoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);

    this.zoom = nextZoom;
    this.viewCenter.x = before.x + (this.size / 2 - canvas.x) / this.zoom;
    this.viewCenter.y = before.y + (this.size / 2 - canvas.y) / this.zoom;
    this.clampViewCenter();
    this.redraw();
  }

  setZoom(zoom, anchorMapX = this.viewCenter.x, anchorMapY = this.viewCenter.y) {
    this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
    this.viewCenter.x = anchorMapX;
    this.viewCenter.y = anchorMapY;
    this.clampViewCenter();
    this.redraw();
  }

  resetZoom() {
    this.zoom = 1;
    this.viewCenter.x = this.size / 2;
    this.viewCenter.y = this.size / 2;
    this.redraw();
  }

  drawSectorGridOnBase() {
    const ctx = this.baseCtx;
    const size = this.size;
    const cols = sectorConfig.columns;
    const rows = sectorConfig.rows;

    ctx.save();

    const grd = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.75);
    grd.addColorStop(0, 'rgba(255,255,255,0.00)');
    grd.addColorStop(1, 'rgba(0,0,0,0.24)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';

    for (let col = 0; col <= cols; col++) {
      const x = Math.round((col / cols) * size) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    for (let row = 0; row <= rows; row++) {
      const y = Math.round((row / rows) * size) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(241,212,138,0.72)';

    for (let col = 0; col <= cols; col++) {
      const x = Math.round((col / cols) * size) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    for (let row = 0; row <= rows; row++) {
      const y = Math.round((row / rows) * size) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cellW = size / cols;
    const cellH = size / rows;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const label = `${sectorConfig.columnLabels[col]}${row + 1}`;
        const x = col * cellW + cellW / 2;
        const y = row * cellH + cellH / 2;

        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.72)';
        ctx.strokeText(label, x, y);

        ctx.fillStyle = 'rgba(255,248,220,0.82)';
        ctx.fillText(label, x, y);
      }
    }

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeRect(2, 2, size - 4, size - 4);

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(241,212,138,0.92)';
    ctx.strokeRect(4, 4, size - 8, size - 8);

    ctx.restore();
  }

  redraw() {
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.size, this.size);

    if (this.ready) {
      const view = this.getViewSourceRect();

      this.ctx.imageSmoothingEnabled = true;
      this.ctx.drawImage(
        this.baseCanvas,
        view.sx,
        view.sy,
        view.sw,
        view.sh,
        0,
        0,
        this.size,
        this.size
      );

      this.drawCurrentSectorHighlight();
      this.drawShipMarker();
      this.status.textContent = this.getStatusText();
      this.updateZoomLabel();
    } else {
      this.drawLoading(this.building ? `Gerando mapa mundi... ${Math.round(this.progress * 100)}%` : 'Preparando mapa mundi...');
    }
  }

  updateZoomLabel() {
    if (!this.zoomLabel) return;
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  drawCurrentSectorHighlight() {
    if (!this.localShip) return;

    const sector = getSectorAtWorld(this.localShip.x, this.localShip.y);

    if (!sector?.isInside) return;

    const cols = sectorConfig.columns;
    const rows = sectorConfig.rows;
    const cellW = this.size / cols;
    const cellH = this.size / rows;
    const view = this.getViewSourceRect();

    const x = (sector.col * cellW - view.sx) * this.zoom;
    const y = (sector.row * cellH - view.sy) * this.zoom;
    const w = cellW * this.zoom;
    const h = cellH * this.zoom;

    if (x + w < 0 || x > this.size || y + h < 0 || y > this.size) return;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255,215,90,0.12)';
    this.ctx.fillRect(x, y, w, h);

    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    this.ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);

    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = 'rgba(255,215,90,0.92)';
    this.ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
    this.ctx.restore();
  }

  drawShipMarker() {
    if (!this.localShip) return;

    const pos = this.worldToCanvas(this.localShip.x, this.localShip.y);

    if (pos.x < -30 || pos.x > this.size + 30 || pos.y < -30 || pos.y > this.size + 30) {
      return;
    }

    const rotation = this.localShip.r ?? this.localShip.rotation ?? 0;

    this.ctx.save();
    this.ctx.translate(pos.x, pos.y);
    this.ctx.rotate(rotation);

    this.ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    this.ctx.lineWidth = 3;
    this.ctx.fillStyle = '#ff3b30';

    this.ctx.beginPath();
    this.ctx.moveTo(13, 0);
    this.ctx.lineTo(-8, -6);
    this.ctx.lineTo(-4, 0);
    this.ctx.lineTo(-8, 6);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(255,255,255,0.70)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  getStatusText() {
    const sector = this.localShip ? getSectorAtWorld(this.localShip.x, this.localShip.y) : null;
    const id = sector?.isInside ? sector.id : '-';
    return `Setor atual: ${id} | Zoom ${Math.round(this.zoom * 100)}% | M/Esc fecha`;
  }

  drawLoading(label) {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.size, this.size);

    const grd = this.ctx.createLinearGradient(0, 0, this.size, this.size);
    grd.addColorStop(0, '#07101a');
    grd.addColorStop(1, '#0b2238');
    this.ctx.fillStyle = grd;
    this.ctx.fillRect(0, 0, this.size, this.size);

    this.ctx.strokeStyle = 'rgba(241,212,138,0.90)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(3, 3, this.size - 6, this.size - 6);

    const barW = this.size * 0.52;
    const barH = 14;
    const barX = (this.size - barW) / 2;
    const barY = this.size / 2 + 32;

    this.ctx.fillStyle = 'rgba(0,0,0,0.50)';
    this.ctx.fillRect(barX, barY, barW, barH);

    this.ctx.fillStyle = 'rgba(241,212,138,0.92)';
    this.ctx.fillRect(barX, barY, barW * this.progress, barH);

    this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    this.ctx.strokeRect(barX, barY, barW, barH);

    this.ctx.fillStyle = '#fff8dc';
    this.ctx.font = 'bold 20px Georgia, serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, this.size / 2, this.size / 2);

    this.ctx.restore();
  }
}
