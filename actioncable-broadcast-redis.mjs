import { generateRandomBytes } from "./utils.mjs";
import redis from "redis";

const PORT = process.env.REDIS_PORT || 6379

class RedisBroadcaster {
  constructor(options = {}) {
    this.options = {
      host: options.host || '127.0.0.1',
      port: options.port || PORT,
      broadcastInterval: options.broadcastInterval || 1000,
      channel: options.channel || 'all',
      debug: options.debug || false
    };

    this.pubClient = null;
    this.connected = false;
    this.messageCount = 0;
  }

  connect() {
    try {
      this.log('Attempting to connect to Redis...');

      this.log('Attempting to connect via port: ', this.options.port);

      this.pubClient = redis.createClient({
        host: this.options.host,
        socket: {
          port: this.options.port,
        },
      });

      this.setupEventHandlers();

      // Explicitly connect to Redis
      this.pubClient.connect().catch(err => {
        this.log('Error during explicit connect:', err);
      });
    } catch (error) {
      this.log('Connection setup error:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  setupEventHandlers() {
    this.pubClient.on('connect', () => {
      this.connected = true;
      this.log('Connected to Redis at', `${this.options.host}:${this.options.port}`);

      // Clear existing interval if any
      if (this.broadcastIntervalId) {
        clearInterval(this.broadcastIntervalId);
      }

      // Start broadcasting after connection
      this.broadcastIntervalId = setInterval(() => this.broadcast(), this.options.broadcastInterval);
      this.log('Broadcast interval started');
    });

    this.pubClient.on('error', (error) => {
      this.log('Redis error:', error);
    });

    this.pubClient.on('end', () => {
      this.connected = false;
      this.log('Connection closed');

      // Clear interval on disconnect
      if (this.broadcastIntervalId) {
        clearInterval(this.broadcastIntervalId);
        this.broadcastIntervalId = null;
      }

      setTimeout(() => this.connect(), 5000);
    });

    // Add ready event handler
    this.pubClient.on('ready', () => {
      this.log('Redis client is ready');
    });
  }

  broadcast() {
    if (!this.connected) {
      this.log('Not connected, skipping broadcast');
      return;
    }

    const payload = {
      count: ++this.messageCount,
      timestamp: new Date().toISOString(),
      value: generateRandomBytes(500),
    };

    const stream = this.options.channel;

    try {
      this.pubClient.publish(stream, JSON.stringify(payload));
      this.log('Broadcasting:', payload);
    } catch (error) {
      this.log('Error publishing message:', error);
    }
  }

  log(...args) {
    if (this.options.debug) {
      console.log('[Action Cable Redis Broadcaster]', ...args);
    }
  }
}

// Usage example - making it async to properly handle the Redis client lifecycle
(async () => {
  console.log('Starting Redis broadcaster...');
  const interval = parseInt(process.argv[2])
  console.log(`Broadcast rate: ${interval}ms`)

  const broadcaster = new RedisBroadcaster({
    host: '127.0.0.1',
    port: PORT,
    broadcastInterval: interval,
    channel: 'all',
    debug: true
  });

  // Keep the process running
  process.stdin.resume();

  // Connect to Redis
  broadcaster.connect();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    if (broadcaster.broadcastIntervalId) {
      clearInterval(broadcaster.broadcastIntervalId);
    }
    if (broadcaster.pubClient) {
      try {
        await broadcaster.pubClient.quit();
        console.log('Redis connection closed');
      } catch (err) {
        console.error('Error closing Redis connection:', err);
      }
    }
    process.exit(0);
  });
})().catch(err => {
  console.error('Error in main process:', err);
  process.exit(1);
});
