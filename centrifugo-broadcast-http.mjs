import { generateRandomBytes } from "./utils.mjs";

const broadcaster = (url, secret) => {
    const broadcastHeaders = {
        'Content-Type': 'application/json'
    };
    if (secret) {
        broadcastHeaders['X-Api-Key'] = secret;
    }
    const broadcast = async (channel, data) => {
        const payload = {
            channel,
            data: data
        };
        const res = await fetch(url, {
            method: 'POST',
            headers: broadcastHeaders,
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            throw new Error(`Error broadcasting to ${channel}: ${res.statusText}`);
        }
    };
    return broadcast;
};

const PORT = 8010;

class AnyCableHTTPBroadcaster {
  constructor(options = {}) {
    this.options = {
      host: options.host || '127.0.0.1',
      port: options.port || PORT,
      broadcastInterval: options.broadcastInterval || 1000,
      channel: options.channel || 'test',
      debug: options.debug || false
    };

    this.broadcaster = broadcaster(`http://${this.options.host}:${this.options.port}/api/publish`);
    this.messageCount = 0;
    this.broadcastIntervalId = null;
  }

  connect() {
    if (this.broadcastIntervalId) {
      clearInterval(this.broadcastIntervalId);
    }

    this.broadcastIntervalId = setInterval(() => this.broadcast(), this.options.broadcastInterval);
  }

  broadcast() {
    const payload = {
      count: ++this.messageCount,
      timestamp: new Date().toISOString(),
      value: generateRandomBytes(500),
    };

    try {
      this.broadcaster("all", payload);
      this.log('Broadcasted message to all:', payload);
    } catch (error) {
      this.log('Error publishing message:', error);
    }
  }

  log(...args) {
    if (this.options.debug) {
      console.log(`${new Date().toISOString()} [Centrifugo Broadcaster]`, ...args);
    }
  }
}

// Usage example - making it async to properly handle the Redis client lifecycle
(async () => {
  console.log('Starting Centrifugo HTTP broadcaster...');
  let interval = parseInt(process.argv[2])
  console.log(`Broadcast rate: ${interval}ms`)

  const broadcaster = new AnyCableHTTPBroadcaster({
    host: '127.0.0.1',
    port: PORT,
    broadcastInterval: interval,
    channel: 'BenchmarkChannel',
    debug: true
  });

  // Keep the process running
  process.stdin.resume();

  broadcaster.connect();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    if (broadcaster.broadcastIntervalId) {
      clearInterval(broadcaster.broadcastIntervalId);
    }
    process.exit(0);
  });
})().catch(err => {
  console.error('Error in main process:', err);
  process.exit(1);
});
