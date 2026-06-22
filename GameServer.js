import { Server } from 'socket.io';
import { WorldModel } from '../shared/world/WorldModel.js';
import { worldConfig } from '../shared/config/worldConfig.js';
import { Simulation } from './Simulation.js';
import { SnapshotBuilder } from './SnapshotBuilder.js';

export class GameServer {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.worldModel = new WorldModel(worldConfig.seed);
    this.simulation = new Simulation(this.worldModel);
    this.tickCounter = 0;
    this.inputsQueue = new Map();
  }

  createDefaultInput() {
    return {
      sailUp: false,
      sailDown: false,
      rudderLeft: false,
      rudderRight: false,
      anchorToggle: false
    };
  }

  start() {
    this.io.on('connection', (socket) => {
      console.log(`[V3 SERVER] Conexão estabelecida: ${socket.id}`);

      const newShip = this.simulation.addShip(socket.id);

      socket.emit('init_handshake', {
        seed: this.worldModel.seed,
        yourId: socket.id,
        spawn: {
          x: newShip.x,
          y: newShip.y
        }
      });

      this.inputsQueue.set(socket.id, this.createDefaultInput());

      socket.on('client_input', (inputData) => {
        const previousInput =
          this.inputsQueue.get(socket.id) ||
          this.createDefaultInput();

        const nextInput = {
          sailUp: !!inputData?.sailUp,
          sailDown: !!inputData?.sailDown,
          rudderLeft: !!inputData?.rudderLeft,
          rudderRight: !!inputData?.rudderRight,

          anchorToggle:
            previousInput.anchorToggle || !!inputData?.anchorToggle
        };

        if (!previousInput.anchorToggle && nextInput.anchorToggle) {
          console.log(`[V3 SERVER] Âncora recebida de ${socket.id}`);
        }

        this.inputsQueue.set(socket.id, nextInput);
      });

      socket.on('disconnect', () => {
        console.log(`[V3 SERVER] Desconectado: ${socket.id}`);
        this.simulation.removeShip(socket.id);
        this.inputsQueue.delete(socket.id);
      });
    });

    setInterval(() => {
      this.update();
    }, 50);
  }

  update() {
    this.tickCounter++;

    for (const [id, input] of this.inputsQueue.entries()) {
      this.simulation.processInput(id, input);

      if (input.anchorToggle) {
        input.anchorToggle = false;
      }
    }

    this.simulation.tick();

    for (const [socketId, socket] of this.io.sockets.sockets.entries()) {
      const snapshot =
        typeof SnapshotBuilder.createDeltaSnapshotForRecipient === 'function'
          ? SnapshotBuilder.createDeltaSnapshotForRecipient(
              this.simulation,
              this.tickCounter,
              socketId
            )
          : SnapshotBuilder.createDeltaSnapshot(
              this.simulation,
              this.tickCounter
            );

      socket.emit('s', snapshot);
    }
  }
}