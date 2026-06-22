export class InputController {
  constructor() {
    this.state = {
      sailUp: false,
      sailDown: false,
      rudderLeft: false,
      rudderRight: false
    };

    this.anchorToggleQueued = false;

    this.initListeners();
  }

  initListeners() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();

      if (k === 'w') this.state.sailUp = true;
      if (k === 's') this.state.sailDown = true;
      if (k === 'a') this.state.rudderLeft = true;
      if (k === 'd') this.state.rudderRight = true;

      if (k === 'r' && !e.repeat) {
        this.anchorToggleQueued = true;
      }

    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();

      if (k === 'w') this.state.sailUp = false;
      if (k === 's') this.state.sailDown = false;
      if (k === 'a') this.state.rudderLeft = false;
      if (k === 'd') this.state.rudderRight = false;
    });

    window.addEventListener('blur', () => {
      this.state.sailUp = false;
      this.state.sailDown = false;
      this.state.rudderLeft = false;
      this.state.rudderRight = false;
      this.anchorToggleQueued = false;
    });
  }

  consumeAnchorTrigger() {
    if (this.anchorToggleQueued) {
      this.anchorToggleQueued = false;
      return true;
    }

    return false;
  }

  getState() {
    const snapshot = {
      sailUp: this.state.sailUp,
      sailDown: this.state.sailDown,
      rudderLeft: this.state.rudderLeft,
      rudderRight: this.state.rudderRight,
      anchorToggle: this.anchorToggleQueued
    };

    this.anchorToggleQueued = false;

    return snapshot;
  }
}
