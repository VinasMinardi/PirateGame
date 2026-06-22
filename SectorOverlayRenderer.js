import * as PIXI from 'pixi.js';
import { sectorConfig } from '../../../shared/config/sectorConfig.js';
import {
  getSectorAtWorld,
  getSectorSizeWorld,
  getWorldBoundsWorld
} from '../../../shared/world/SectorGrid.js';

export const SHOW_SECTOR_GRID = true;

function drawLine(graphics, x1, y1, x2, y2, color, alpha, width) {
  graphics.moveTo(x1, y1);
  graphics.lineTo(x2, y2);

  // PIXI v8.
  if (typeof graphics.stroke === 'function') {
    graphics.stroke({ color, alpha, width });
    return;
  }

  // Fallback para API legacy.
  if (typeof graphics.lineStyle === 'function') {
    graphics.lineStyle(width, color, alpha);
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
  }
}

function drawRectOutline(graphics, x, y, w, h, color, alpha, width) {
  if (typeof graphics.rect === 'function' && typeof graphics.stroke === 'function') {
    graphics.rect(x, y, w, h);
    graphics.stroke({ color, alpha, width });
    return;
  }

  drawLine(graphics, x, y, x + w, y, color, alpha, width);
  drawLine(graphics, x + w, y, x + w, y + h, color, alpha, width);
  drawLine(graphics, x + w, y + h, x, y + h, color, alpha, width);
  drawLine(graphics, x, y + h, x, y, color, alpha, width);
}

export class SectorOverlayRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    this.enabled = options.enabled ?? SHOW_SECTOR_GRID;
    this.lineColor = options.lineColor ?? 0xf1d48a;
    this.lineAlpha = options.lineAlpha ?? 0.74;
    this.lineWidth = options.lineWidth ?? 3;
    this.outlineColor = 0x000000;
    this.worldBounds = getWorldBoundsWorld();
    this.sectorSize = getSectorSizeWorld();

    this.metrics = {
      visibleLines: 0,
      currentSector: '-'
    };
  }

  render(camera, currentSectorId = '-') {
    this.graphics.clear();

    if (!this.enabled) {
      this.metrics.visibleLines = 0;
      this.metrics.currentSector = currentSectorId;
      return;
    }

    const bounds = camera.getViewportWorldBounds(0);
    const margin = 64;
    const minX = bounds.minX - margin;
    const maxX = bounds.maxX + margin;
    const minY = bounds.minY - margin;
    const maxY = bounds.maxY + margin;
    let visibleLines = 0;

    // Linhas de divisao dos setores, com contorno escuro para aparecer sobre mar e terra.
    for (let col = 0; col <= sectorConfig.columns; col++) {
      const x = this.worldBounds.minX + col * this.sectorSize;

      if (x < minX || x > maxX) continue;

      drawLine(this.graphics, x, minY, x, maxY, this.outlineColor, 0.28, this.lineWidth + 5);
      drawLine(this.graphics, x, minY, x, maxY, this.lineColor, this.lineAlpha, this.lineWidth);
      drawLine(this.graphics, x, minY, x, maxY, 0xffffff, 0.26, 1);
      visibleLines++;
    }

    for (let row = 0; row <= sectorConfig.rows; row++) {
      const y = this.worldBounds.minY + row * this.sectorSize;

      if (y < minY || y > maxY) continue;

      drawLine(this.graphics, minX, y, maxX, y, this.outlineColor, 0.28, this.lineWidth + 5);
      drawLine(this.graphics, minX, y, maxX, y, this.lineColor, this.lineAlpha, this.lineWidth);
      drawLine(this.graphics, minX, y, maxX, y, 0xffffff, 0.26, 1);
      visibleLines++;
    }

    // Destaque discreto do setor atual, como referencia de entrada/troca de setor.
    const sector = getSectorAtWorld(camera.x, camera.y);

    if (sector?.isInside && sector.boundsWorld) {
      drawRectOutline(
        this.graphics,
        sector.boundsWorld.minX,
        sector.boundsWorld.minY,
        sector.boundsWorld.width,
        sector.boundsWorld.height,
        0x000000,
        0.22,
        8
      );

      drawRectOutline(
        this.graphics,
        sector.boundsWorld.minX,
        sector.boundsWorld.minY,
        sector.boundsWorld.width,
        sector.boundsWorld.height,
        0xffd75a,
        0.36,
        3
      );
    }

    this.metrics.visibleLines = visibleLines;
    this.metrics.currentSector = sector?.id ?? currentSectorId;
  }
}
