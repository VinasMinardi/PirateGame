export class Hud {
  constructor(rootId, worldModel, minimapRenderer = null) {
    this.root = document.getElementById(rootId);
    this.worldModel = worldModel;
    this.minimapRenderer = minimapRenderer;
    this.currentSectorId = null;
    this.sectorToastTimeout = null;

    this.initStructure();
  }

  initStructure() {
    this.root.innerHTML = `
      <div id="sector-transition-toast" style="
        position: absolute;
        top: 86px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 26px;
        background: rgba(12, 10, 7, 0.86);
        border: 2px solid rgba(255, 215, 90, 0.95);
        color: #fff8dc;
        font-family: Georgia, serif;
        font-size: 22px;
        font-weight: bold;
        letter-spacing: 1px;
        text-shadow: 0 2px 4px #000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
        z-index: 20;
      ">
        Setor -
      </div>

      <div class="hud-container">
        <div class="hud-item">
          <div class="hud-label">Embarcação</div>
          <div id="hud-ship-name" class="hud-value">-</div>
        </div>
        <div class="hud-item">
          <div class="hud-label">Setor</div>
          <div id="hud-sector" class="hud-value">-</div>
        </div>
        <div class="hud-item">
          <div class="hud-label">Velame (W/S)</div>
          <div id="hud-sail" class="hud-value">0%</div>
        </div>
        <div class="hud-item">
          <div class="hud-label">Ângulo Leme (A/D)</div>
          <div id="hud-rudder" class="hud-value">0°</div>
        </div>
        <div class="hud-item">
          <div class="hud-label">Velocidade Corrente</div>
          <div id="hud-speed" class="hud-value">0.0 nós</div>
        </div>
        <div class="hud-item">
          <div class="hud-label">Âncora (R)</div>
          <div id="hud-anchor" class="hud-value">RECOLHIDA</div>
        </div>
      </div>

      <div class="minimap-container">
        <canvas id="minimap-canvas" class="minimap-canvas" width="220" height="220"></canvas>
      </div>
    `;

    const canvas = document.getElementById('minimap-canvas');

    if (this.minimapRenderer) {
      this.minimapRenderer.attach(canvas);
    }
  }

  update(localShip) {
    const sectorId =
      localShip.sec ||
      this.worldModel.getSectorAtWorld(localShip.x, localShip.y).id;

    document.getElementById('hud-ship-name').innerText = localShip.n;
    document.getElementById('hud-sector').innerText = sectorId;
    document.getElementById('hud-sail').innerText = `${Math.round(localShip.s * 100)}%`;

    const rudderDeg = Math.round(localShip.rud * (180 / Math.PI));
    document.getElementById('hud-rudder').innerText = `${rudderDeg}°`;

    document.getElementById('hud-speed').innerText = `${(localShip.spd * 1.5).toFixed(1)} nós`;
    document.getElementById('hud-anchor').innerText = localShip.anc ? 'LANÇADA' : 'RECOLHIDA';

    this.checkSectorTransition(sectorId);
  }

  checkSectorTransition(sectorId) {
    if (!sectorId || sectorId === 'FORA') return;

    if (this.currentSectorId === null) {
      this.currentSectorId = sectorId;
      return;
    }

    if (this.currentSectorId !== sectorId) {
      this.currentSectorId = sectorId;
      this.showSectorTransition(sectorId);
    }
  }

  showSectorTransition(sectorId) {
    const toast = document.getElementById('sector-transition-toast');
    if (!toast) return;

    toast.innerText = `Entrando no setor ${sectorId}`;
    toast.style.opacity = '1';

    if (this.sectorToastTimeout) {
      clearTimeout(this.sectorToastTimeout);
    }

    this.sectorToastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
    }, 1600);
  }

  updateMinimap(localShip, currentTime) {
    if (!this.minimapRenderer) return;

    this.minimapRenderer.update(localShip, currentTime);
  }
}
