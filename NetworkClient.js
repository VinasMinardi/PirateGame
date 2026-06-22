import { io } from 'socket.io-client';

export class NetworkClient {
  constructor() {
    this.socket = null;
    this.latestSnapshot = null;
    this.yourId = null;
    this.onInitCallback = null;
    this.ping = 0;
  }

  connect(url, onInit) {
    this.onInitCallback = onInit;
    this.socket = io(url);

    this.socket.on('init_handshake', (data) => {
      this.yourId = data.yourId;
      if (this.onInitCallback) this.onInitCallback(data);
    });

    this.socket.on('s', (snapshot) => {
      this.latestSnapshot = snapshot;
      this.ping = Date.now() - snapshot.ts; // Cálculo aproximado de latência de transporte
    });
  }

  sendInput(inputState) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('client_input', inputState);
    }
  }
}
