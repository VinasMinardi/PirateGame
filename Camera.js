export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.zoom = 1.0;
  }

  resize(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  update(targetX, targetY, speed = 0, angle = 0, deltaTime = 1 / 60) {
    this.x = targetX;
    this.y = targetY;
  }

  getViewportWorldBounds(tileSize) {
    const hw = (this.viewportWidth / 2) / this.zoom;
    const hh = (this.viewportHeight / 2) / this.zoom;

    return {
      minX: this.x - hw - tileSize,
      maxX: this.x + hw + tileSize,
      minY: this.y - hh - tileSize,
      maxY: this.y + hh + tileSize
    };
  }
}
