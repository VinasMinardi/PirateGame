import * as PIXI from 'pixi.js';
import { OrganicMapRenderer } from './organic/OrganicMapRenderer.js';
import { OrganicMinimapRenderer } from './organic/OrganicMinimapRenderer.js';
import { OrganicWorldMapOverlay } from './organic/OrganicWorldMapOverlay.js';
import { SectorOverlayRenderer } from './organic/SectorOverlayRenderer.js';
import { ShipRenderer } from './ShipRenderer.js';
import { TilesetFactory } from './TilesetFactory.js';

export class PixiRenderer {
  constructor(containerId, worldModel) {
    this.container = document.getElementById(containerId);
    this.worldModel = worldModel;
    this.app = new PIXI.Application();
    this.factory = new TilesetFactory();

    this.layerMap = new PIXI.Container();
    this.layerSectorOverlay = new PIXI.Container();
    this.layerEntities = new PIXI.Container();

    this.organicMapRenderer = null;
    this.organicMinimapRenderer = null;
    this.organicWorldMapOverlay = null;
    this.sectorOverlayRenderer = null;
    this.shipRenderer = null;
  }

  async init() {
    await this.app.init({
      resizeTo: window,
      backgroundColor: 0x0f2a4a,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    this.container.innerHTML = '';
    const canvas = this.app.canvas || this.app.view;
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.display = 'block';
    this.container.appendChild(canvas);

    this.app.stage.addChild(this.layerMap);
    this.app.stage.addChild(this.layerSectorOverlay);
    this.app.stage.addChild(this.layerEntities);

    await this.factory.createProceduralAtlas(this.app.renderer);
    this.organicMapRenderer = new OrganicMapRenderer(this.layerMap);
    await this.organicMapRenderer.initDiskCache();
    await this.organicMapRenderer.initBakedChunkCache();

    this.organicMinimapRenderer = new OrganicMinimapRenderer(this.organicMapRenderer.field);
    this.organicWorldMapOverlay = new OrganicWorldMapOverlay(this.organicMapRenderer.field);
    this.sectorOverlayRenderer = new SectorOverlayRenderer(this.layerSectorOverlay);

    this.organicMapRenderer.minimapMetrics = this.organicMinimapRenderer.metrics;
    this.organicMapRenderer.sectorOverlayMetrics = this.sectorOverlayRenderer.metrics;
    this.shipRenderer = new ShipRenderer(this.layerEntities, this.factory);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.app.renderer.resize(window.innerWidth, window.innerHeight);

    this.layerMap.position.set(window.innerWidth / 2, window.innerHeight / 2);
    this.layerSectorOverlay.position.set(window.innerWidth / 2, window.innerHeight / 2);
    this.layerEntities.position.set(window.innerWidth / 2, window.innerHeight / 2);
  }

  renderWorld(camera, ships, localPlayerId, deltaTime) {
    this.organicMapRenderer.render(camera);
    const localShip = ships.find((ship) => ship.id === localPlayerId);

    this.sectorOverlayRenderer.render(camera, localShip?.sec ?? '-');
    this.organicMapRenderer.minimapMetrics = this.organicMinimapRenderer.metrics;
    this.organicMapRenderer.sectorOverlayMetrics = this.sectorOverlayRenderer.metrics;

    this.layerSectorOverlay.position.set(window.innerWidth / 2, window.innerHeight / 2);
    this.layerSectorOverlay.pivot.set(camera.x, camera.y);

    this.layerEntities.position.set(window.innerWidth / 2, window.innerHeight / 2);
    this.layerEntities.pivot.set(camera.x, camera.y);

    this.shipRenderer.render(ships, localPlayerId);
    this.organicWorldMapOverlay?.update(localShip);
  }
}
