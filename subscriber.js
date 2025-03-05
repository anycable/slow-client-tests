const WebSocket = require('ws');

STANDARD_PORT = 8080;

// Run toxiproxy on this port so we can conditionally make it slow
// and see if subscribers can cause cross impact across streams
SLOW_PORT = 8081;

N = (process.env.N || 10) | 0;

let lastMessageIn = 0;
let wasStuck = false;

class WebSocketSubscriber {
  constructor(wsUrl, options = {}) {
    this.wsUrl = wsUrl;
    this.options = {
      reconnectInterval: options.reconnectInterval || 5000,
      channel: options.channel || 'BenchmarkChannel',
      debug: options.debug || false,
      name: options.name,
    };

    this.ws = null;
    this.connected = false;
    this.messagesReceived = 0;
    this.channelIdentifier = JSON.stringify({ channel: this.options.channel });
  }

  connect() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      this.log('Connection error:', error);
      setTimeout(() => this.connect(), this.options.reconnectInterval);
    }
  }

  setupEventHandlers() {
    this.ws.onopen = () => {
      this.connected = true;
      this.log('Connected to', this.wsUrl);

      // Subscribe to channel immediately after connection
      this.subscribe();
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.log('Connection closed');
      setTimeout(() => this.connect(), this.options.reconnectInterval);
    };

    this.ws.onerror = (error) => {
      this.log('WebSocket error:', error);
    };

    this.ws.onmessage = (rawMessage) => {
      // Always log the raw message
      // this.log('Raw message received:', rawMessage.data);
      // this.log('Current channel identifier:', this.channelIdentifier);

      try {
        const message = JSON.parse(rawMessage.data);
        // this.log('Parsed message:', message);

        // Handle welcome message
        if (message.type === 'welcome') {
          // this.log('Received welcome message');
          return;
        }

        // Handle ping messages
        if (message.type === 'ping') {
          // this.log('Received ping');
          return;
        }

        // Handle confirm_subscription message
        if (message.type === 'confirm_subscription') {
          // this.log('Subscription confirmed');
          return;
        }

        // Handle broadcast messages
        // Check if this message is for our channel
        if (message.identifier === this.channelIdentifier) {
          this.messagesReceived++;

          let now = Date.now();

          if (this.options.name !== 'Slow subscriber' && lastMessageIn > 0 && now - lastMessageIn > 100 ) {
            this.log(`Got stuck before recieving broadcast #${this.messagesReceived}, delay: ${now - lastMessageIn}ms`);
            // this.log(`Recieved broadcast #${this.messagesReceived}`);
            // this.log('Received broadcast:', {
            //   messageNumber: this.messagesReceived,
            //   data: message.data
            // });
          }

          if (this.options.name === 'Slow subscriber') {
            this.log(`Recieved broadcast #${this.messagesReceived}`);
          }

          if (this.options.name !== 'Slow subscriber') {
            lastMessageIn = now;
          }
        }
      } catch (error) {
        this.log("Encountered issue on message rx:", error);
      }
    };
  }

  subscribe() {
    const subscribeMsg = {
      command: 'subscribe',
      identifier: this.channelIdentifier
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    this.log('Subscribing with:', subscribeMsg);
  }

  log(...args) {
    if (this.options.debug) {
      console.log(`${new Date().toISOString()} [${this.options.name}]`, ...args);
    }
  }
}

function main() {
  try {
    for (let i=0; i<N; i++) {
      const subscriber = new WebSocketSubscriber(`ws://127.0.0.1:${STANDARD_PORT}/cable`, {
        name: `Subscriber: ${i}`,
        channel: 'BenchmarkChannel',
        debug: true,
      });
      subscriber.connect();
    }

    const subscriber = new WebSocketSubscriber(`ws://127.0.0.1:${SLOW_PORT}/cable`, {
      name: 'Slow subscriber',
      channel: 'BenchmarkChannel',
      debug: true,
    });
    subscriber.connect();

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
