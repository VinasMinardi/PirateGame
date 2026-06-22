import * as PIXI from 'pixi.js';

export class TilesetFactory {
  constructor() {
    this.textures = new Map();
  }

  async createProceduralAtlas() {
    const tileSize = 64;

    const createTileTexture = (baseColor, drawFn) => {
      const canvas = document.createElement('canvas');
      canvas.width = tileSize;
      canvas.height = tileSize;
      const ctx = canvas.getContext('2d');

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, tileSize, tileSize);

      if (drawFn) drawFn(ctx, tileSize);
      return PIXI.Texture.from(canvas);
    };

    this.textures.set('deep_base', createTileTexture('#0f2a4a', (c) => {
      c.strokeStyle = 'rgba(80, 145, 190, 0.30)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(8, 22);
      c.quadraticCurveTo(20, 14, 34, 22);
      c.quadraticCurveTo(45, 29, 57, 22);
      c.stroke();
    }));

    this.textures.set('deep_var1', createTileTexture('#0d2543', (c) => {
      c.strokeStyle = 'rgba(80, 145, 190, 0.18)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(12, 43);
      c.quadraticCurveTo(25, 35, 40, 43);
      c.stroke();
    }));

    this.textures.set('shallow_base', createTileTexture('#1d5573', (c) => {
      c.fillStyle = 'rgba(80, 175, 200, 0.16)';
      c.fillRect(0, 0, 64, 4);
      c.fillRect(0, 28, 64, 3);
    }));

    this.textures.set('sand_base', createTileTexture('#e3c283', (c) => {
      c.fillStyle = 'rgba(115, 82, 34, 0.20)';
      c.fillRect(10, 15, 3, 3);
      c.fillRect(40, 45, 3, 3);
      c.fillRect(25, 31, 2, 2);
    }));

    this.textures.set('land_base', createTileTexture('#386b3e', (c) => {
      c.fillStyle = '#2e5c33';
      c.fillRect(5, 5, 20, 20);
      c.fillRect(35, 35, 25, 20);
      c.fillStyle = 'rgba(80, 140, 60, 0.35)';
      c.fillRect(18, 40, 14, 10);
    }));

    this.textures.set('rock_base', createTileTexture('#5a5e6b', (c) => {
      c.fillStyle = '#474a54';
      c.beginPath();
      c.moveTo(10, 54);
      c.lineTo(32, 10);
      c.lineTo(54, 54);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.stroke();
    }));

    this.textures.set('edge_n_land_sand', createTileTexture('#386b3e', (c) => {
      c.fillStyle = '#e3c283';
      c.beginPath();
      c.moveTo(0, 50);
      c.bezierCurveTo(16, 45, 28, 56, 42, 49);
      c.bezierCurveTo(52, 45, 59, 52, 64, 48);
      c.lineTo(64, 64);
      c.lineTo(0, 64);
      c.closePath();
      c.fill();
    }));

    this.textures.set('edge_s_land_sand', createTileTexture('#386b3e', (c) => {
      c.fillStyle = '#e3c283';
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(64, 0);
      c.lineTo(64, 14);
      c.bezierCurveTo(48, 18, 34, 8, 20, 15);
      c.bezierCurveTo(9, 20, 4, 12, 0, 16);
      c.closePath();
      c.fill();
    }));

    this.textures.set('edge_n_sand_shallow', createTileTexture('#e3c283', (c) => {
      c.fillStyle = '#1d5573';
      c.beginPath();
      c.moveTo(0, 49);
      c.bezierCurveTo(18, 55, 30, 45, 44, 51);
      c.bezierCurveTo(55, 56, 61, 50, 64, 54);
      c.lineTo(64, 64);
      c.lineTo(0, 64);
      c.closePath();
      c.fill();
    }));

    this.textures.set('edge_n_shallow_deep', createTileTexture('#1d5573', (c) => {
      c.fillStyle = '#0f2a4a';
      c.beginPath();
      c.moveTo(0, 51);
      c.bezierCurveTo(17, 47, 28, 56, 42, 50);
      c.bezierCurveTo(54, 46, 61, 52, 64, 49);
      c.lineTo(64, 64);
      c.lineTo(0, 64);
      c.closePath();
      c.fill();
    }));

    const shipCanvas = document.createElement('canvas');
    shipCanvas.width = 64;
    shipCanvas.height = 64;
    const s = shipCanvas.getContext('2d');
    s.imageSmoothingEnabled = false;
    s.fillStyle = '#7a4b26';
    s.beginPath();
    s.moveTo(50, 32);
    s.lineTo(17, 15);
    s.lineTo(9, 32);
    s.lineTo(17, 49);
    s.closePath();
    s.fill();
    s.strokeStyle = '#3b2412';
    s.lineWidth = 3;
    s.stroke();
    s.fillStyle = '#f3ead7';
    s.fillRect(23, 22, 8, 20);
    s.fillStyle = '#c9b18b';
    s.fillRect(31, 26, 5, 13);
    this.textures.set('ship_player', PIXI.Texture.from(shipCanvas));

    console.log('[V3 RENDER] Texturas procedurais geradas sem BaseTexture, compatível com PixiJS v8.');
  }

  getTexture(key) {
    return this.textures.get(key) || this.textures.get('deep_base');
  }
}
