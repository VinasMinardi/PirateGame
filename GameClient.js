import { WorldModel } from '../shared/world/WorldModel.js';
import { Camera } from './camera/Camera.js';
import { PixiRenderer } from './render/PixiRenderer.js';
import { InputController } from './input/InputController.js';
import { NetworkClient } from './network/NetworkClient.js';
import { ClientState } from './ClientState.js';
import { GameLoop } from './GameLoop.js';
import { Hud } from './ui/Hud.js';
import { GamePreloader, LoadingOverlay } from './loading/GamePreloader.js';

export class GameClient {
  constructor() {
    this.worldModel = null;
    this.camera = new Camera();
    this.renderer = null;
    this.input = new InputController();
    this.network = new NetworkClient();
    this.state = new ClientState();
    this.loop = null;
    this.hud = null;
  }

  async bootstrap() {
    console.log('[V3 CLIENT] Bootstrapping Infinity V3 Engine...');
    const loadingOverlay = new LoadingOverlay();
    loadingOverlay.setProgress(0, 'Conectando ao servidor...');

    this.network.connect('http://localhost:3001', async (initData) => {
      this.worldModel = new WorldModel(initData.seed);
      loadingOverlay.setProgress(0.04, 'Iniciando renderizador...');

      this.renderer = new PixiRenderer('game-container', this.worldModel);
      await this.renderer.init();

      const preloader = new GamePreloader({
        worldModel: this.worldModel,
        renderer: this.renderer,
        onProgress: (progress, message) => {
          loadingOverlay.setProgress(progress, message);
        }
      });

      await preloader.run(initData.spawn);

      this.hud = new Hud('hud-root', this.worldModel, this.renderer.organicMinimapRenderer);

      this.camera.x = initData.spawn.x;
      this.camera.y = initData.spawn.y;

      this.loop = new GameLoop(
        (dt, ct) => this.update(dt, ct),
        (dt) => this.render(dt)
      );

      this.loop.start();
      loadingOverlay.destroy();
    });
  }

  update(deltaTime, currentTime) {
    const inputState = this.input.getState();
    this.network.sendInput(inputState);

    this.state.updateFromSnapshot(
      this.network.latestSnapshot,
      this.network.yourId
    );

    const localShip = this.state.getLocalShip();

    if (localShip) {
      this.camera.update(
        localShip.x,
        localShip.y,
        localShip.spd,
        localShip.r,
        deltaTime
      );

      this.hud.update(localShip);

      if (this.hud.updateMinimap.length >= 3) {
        this.hud.updateMinimap(localShip, this.worldModel, currentTime);
      } else {
        this.hud.updateMinimap(localShip, currentTime);
      }
    }
  }

  render(deltaTime) {
    if (!this.renderer) return;

    this.renderer.renderWorld(
      this.camera,
      this.state.ships,
      this.network.yourId,
      deltaTime
    );
  }
}
