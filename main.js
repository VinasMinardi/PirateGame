import { GameClient } from './GameClient.js';

window.addEventListener('DOMContentLoaded', () => {
  const core = new GameClient();
  core.bootstrap().catch(err => {
    console.error("[V3 FATAL CRASH] Falha crítica na inicialização da V3 Core Engine:", err);
  });
});
