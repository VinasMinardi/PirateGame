import * as PIXI from 'pixi.js';

function createText(text, style) {
  try {
    return new PIXI.Text({ text, style });
  } catch (error) {
    return new PIXI.Text(text, style);
  }
}

export class ShipRenderer {
  constructor(container, factory) {
    this.container = container;
    this.factory = factory;
    this.sprites = new Map();
  }

  render(ships, localPlayerId) {
    const activeIds = new Set();

    for (const s of ships) {
      activeIds.add(s.id);
      let shipContainer = this.sprites.get(s.id);

      if (!shipContainer) {
        shipContainer = new PIXI.Container();

        const sprite = new PIXI.Sprite(this.factory.getTexture('ship_player'));
        sprite.anchor.set(0.5);
        sprite.width = 48;
        sprite.height = 48;
        shipContainer.addChild(sprite);

        const text = createText(s.n, {
          fontSize: 13,
          fill: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        });
        text.anchor.set(0.5);
        text.y = -35;
        shipContainer.addChild(text);

        this.container.addChild(shipContainer);
        this.sprites.set(s.id, shipContainer);
      }

      shipContainer.x = s.x;
      shipContainer.y = s.y;
      shipContainer.rotation = s.r;

      const mainSailSprite = shipContainer.children[0];
      mainSailSprite.alpha = s.s === 0 ? 0.75 : 1.0;
    }

    for (const id of this.sprites.keys()) {
      if (!activeIds.has(id)) {
        this.container.removeChild(this.sprites.get(id));
        this.sprites.delete(id);
      }
    }
  }
}
