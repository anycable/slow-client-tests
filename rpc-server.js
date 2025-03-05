const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Load the protobuf definition
const PROTO_PATH = path.join(__dirname, 'rpc.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const rpc = protoDescriptor.anycable;

// Status enum values from proto
const Status = {
  ERROR: 0,
  SUCCESS: 1,
  FAILURE: 2
};

// Implement the RPC methods
const rpcImplementation = {
  Connect: (call, callback) => {
    console.log('Connect called:', call.request);

    // Create a unique identifier for the connection
    const identifiers = JSON.stringify({
      connection_id: Math.random().toString(36).substring(2, 15)
    });

    // Create welcome transmission
    const welcome = JSON.stringify({
      type: 'welcome',
      sid: Math.random().toString(36).substring(2, 15)
    });

    callback(null, {
      status: Status.SUCCESS,  // Use enum value
      identifiers: identifiers,
      transmissions: [welcome],
      error_msg: '',
      env: {
        cstate: {},
        istate: {}
      }
    });
  },

  Command: (call, callback) => {
    console.log('Command called:', call.request);

    let response = {
      status: Status.SUCCESS,  // Use enum value
      disconnect: false,
      stop_streams: false,
      streams: [],
      transmissions: [],
      error_msg: '',
      env: {
        cstate: {},
        istate: {}
      },
      stopped_streams: []
    };

    if (call.request.command === 'subscribe') {
      const { stream_name } = JSON.parse(call.request.identifier);
      response.streams = [stream_name];
    }

    callback(null, response);
  },

  Disconnect: (call, callback) => {
    console.log('Disconnect called:', call.request);
    callback(null, {
      status: Status.SUCCESS,  // Use enum value
      error_msg: ''
    });
  }
};

// Create and start the server
function startServer() {
  const server = new grpc.Server();
  server.addService(rpc.RPC.service, rpcImplementation);

  server.bindAsync(
    '0.0.0.0:50051',
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to start gRPC server:', error);
        return;
      }
      server.start();
      console.log('gRPC server running on port 50051');
    }
  );

  return server;
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down gRPC server...');
  process.exit();
});

module.exports = { startServer };

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}
