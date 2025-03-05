import WebSocket from 'ws';
import { Centrifuge } from 'centrifuge';

const HOST = '127.0.0.1';
const STANDARD_PORT = 8010;
const SLOW_PORT = 8011;
const ALWAYS_LOG_SLOW = process.env.LOG_SLOW === 'true';
const SKIP_SLOW = process.env.SKIP_SLOW === 'true';

const N = (process.env.N || 10) | 0;

let lastMessageIn = 0;
let wasStuck = false;

class Subscriber {
  constructor(url, opts = {}) {
    let { slow } = opts;
    this.options = opts;
    this.url = url;
    this.slow = slow;

    this.connected = false;
    this.messagesReceived = 0;
  }

  connect() {
    const centrifuge = new Centrifuge(this.url, { websocket: WebSocket });
    const sub = centrifuge.newSubscription('all');

    sub.on('publication', (ctx) => {
      this.messagesReceived++;
      this.logMessage(ctx.data);
    });

    centrifuge.on('connected', () => {
      this.connected = true;
      this.log('Connected to', this.url);
    });

    centrifuge.on('disconnected', () => {
      this.connected = false;
      this.log('Connection closed');
    });

    sub.subscribe();
    centrifuge.connect();
  }

  log(...args) {
    if (this.options.debug) {
      console.log(`${new Date().toISOString()} [${this.slow ? 'slow' : 'normal'}]`, ...args);
    }
  }

  logMessage(message) {
    let now = Date.now();
    if (!this.slow && lastMessageIn > 0 && now - lastMessageIn > 100) {
      this.log(`Got stuck before recieving broadcast #${this.messagesReceived}, delay: ${now - lastMessageIn}ms`);
      wasStuck = true;
    }

    if (!this.slow) {
      lastMessageIn = now;
    } else if (wasStuck || ALWAYS_LOG_SLOW) {
      this.log(`Received message ${this.messagesReceived}:`, message.count);
      wasStuck = false;
    }
  }
}

function main() {
  try {
    for (let i=0; i<N; i++) {
      const subscriber = new Subscriber(`ws://${HOST}:${STANDARD_PORT}/connection/websocket`, {debug: true});
      subscriber.connect();
    }

    if (!SKIP_SLOW) {
      const subscriber = new Subscriber(`ws://${HOST}:${SLOW_PORT}/connection/websocket`, {slow: true, debug: true});
      subscriber.connect();
    }

    console.log("All subscribers are setup and running...");
  } catch (error) {
    console.log("Something went wrong:", error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit();
});

main()
