export class GameLoop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.lastTime = 0;
    this.running = false;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(currentTime) {
    if (!this.running) return;

    let deltaTime = (currentTime - this.lastTime) / 1000;
    // Cap preventivo de delta de tempo para travar engasgos de frames suspensos de abas secundárias
    if (deltaTime > 0.1) deltaTime = 0.1; 

    this.lastTime = currentTime;

    this.updateFn(deltaTime, currentTime);
    this.renderFn(deltaTime);

    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
  }
}
