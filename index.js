import express from 'express';
import { createServer } from 'http';
import { GameServer } from './GameServer.js';

const app = express();
const server = createServer(app);
const gameServer = new GameServer(server);

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 INFINITY V3 SERVER RUNNING ON PORT: ${PORT}`);
  console.log(`🎮 MÓDULO: MAP & SAILING CORE INICIADO DO ZERO`);
  console.log(`====================================================`);
  gameServer.start();
});
