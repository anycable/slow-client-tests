# Slow client load test experiment

This directory contains a few scripts that can be used to generate artificial load against various WebSocket servers (AnyCable, ActionCable, Centrifugo).

We want to see how a server handles the situation where a client is slower at ingesting data than our broadcaster.

This repository was originally created by [Caleb Thorsteinson](https://github.com/thorsteinson) to reproduce the issue in AnyCable (stalled broadcasts).

## Setup

Ensure you have the following installed:

- NodeJS
- [Toxiproxy](https://github.com/Shopify/toxiproxy)
- Redis (only needed for Action Cable tests)

## How To Run

Get ready to open up a bunch of terminals, we'll need them setup. The order here matters, since some
of these depend on others.

First, launch and configure Toxiproxy:

```
toxiproxy-server -config ./toxiproxy.json
toxiproxy-cli toxic add -t bandwidth -a rate=1 anycable_slow
toxiproxy-cli toxic add -t bandwidth -a rate=1 centrifugo_slow
```

Then, you need to run a server and the corresponding subscribers and broadcasting scripts.

### Action Cable

To test Action Cable, you need to have a Redis running locally. We also provide a minimal AnyCable RPC server that could be used to authenticate clients and authorized subscriptions.

You can run it as follows:

```
node rpc-server.js
```

Then, you can run the minimal Action Cable server using [Anyt](https://github.com/anycable/anyt) as follows:

```sh
PUMA_PORT=8080 anyt --only-rails
```

Use `anycable-subscribers.mjs` to start the subscribers (10 fast and 1 slow by default):

```
node anycable-subscribers.mjs
```

Use `actioncable-broadcast-redis.mjs` to start broadcasting:

```
node actioncable-broadcast-redis.mjs 50
```

The second argument is the delay in milliseconds between messages.

### AnyCable

Run AnyCable server. You can use a locally built version, or any standard version that's been released so far.

Run it as such:

```sh
anycable-go --public --broadcast_adapter=http
```

Use `anycable-subscribers.mjs` to start the subscribers (10 fast and 1 slow by default):

```
node anycable-subscribers.mjs
```

Use `anycable-broadcast-http.mjs` to start broadcasting:

```
node anycable-broadcast-http.mjs 50
```

### Centrifugo

Run Centrifugo server. You can use a locally built version, or any standard version that's been released so far.

Run it as such:

```sh
centrifugo -p 8010 --log.level=info --http_api.insecure --client.insecure
```

Use `centrifugo-subscribers.mjs` to start the subscribers (10 fast and 1 slow by default):

```
node centrifugo-subscribers.mjs
```

Use `centrifugo-broadcast-http.mjs` to start broadcasting:

```
node centrifugo-broadcast-http.mjs 50
```

## Expected Behavior

After everything has started, you'll see the slow subscriber begin to echo the messages being
published (fast subscriber logs are disabled by default). Whenever (and if) a fast subscriber do not receive a message in 100ms, it prints a "Got stuck" warning—that means, that the slow subscriber introduced a delay in broadasting (contention).

We also recommend monitoring the memory usage of the server to see how slow clients are affecting the server's performance. You can use the [process-metrics gem](https://github.com/socketry/process-metrics) for that.
