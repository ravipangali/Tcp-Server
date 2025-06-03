const net = require('net');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const GT06Decoder = require('./gt06_decoder');
const GT06Database = require('./database');
const setupAPIRoutes = require('./api_routes');

// Configuration
const TCP_HOST = '84.247.131.246';
const TCP_PORT = 5000;
const API_PORT = 3000;

class GT06Server {
  constructor() {
    this.database = new GT06Database();
    this.tcpServer = null;
    this.apiServer = null;
    this.clients = new Map(); // Track client connections
    this.stats = {
      totalPackets: 0,
      totalClients: 0,
      startTime: new Date()
    };
  }

  /**
   * Initialize the complete GT06 server system
   */
  async init() {
    try {
      console.log('🚀 Initializing GT06 Comprehensive Protocol Decoder...');
      
      // Wait for database to be ready
      await this.database.init();
      
      // Start TCP server for GT06 protocol
      this.startTCPServer();
      
      // Start API server for data access
      this.startAPIServer();
      
      console.log('✅ GT06 Server System fully initialized');
      console.log(`📡 TCP Server listening on ${TCP_HOST}:${TCP_PORT}`);
      console.log(`🌐 API Server listening on http://localhost:${API_PORT}`);
      console.log(`📚 API Documentation: http://localhost:${API_PORT}/api/docs`);
      
    } catch (error) {
      console.error('❌ Failed to initialize GT06 server:', error);
      process.exit(1);
    }
  }

  /**
   * Start TCP server for receiving GT06 protocol data
   */
  startTCPServer() {
    this.tcpServer = net.createServer((socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      const decoder = new GT06Decoder();
      
      console.log(`📱 Client connected: ${clientId}`);
      this.stats.totalClients++;
      
      // Store client info
      this.clients.set(clientId, {
        socket,
        decoder,
        connectedAt: new Date(),
        lastActivity: new Date(),
        packetsReceived: 0
      });

      // Handle incoming data
      socket.on('data', async (data) => {
        try {
          const client = this.clients.get(clientId);
          if (!client) return;

          client.lastActivity = new Date();
          
          console.log(`📨 Received data from ${clientId}: ${data.toString('hex').toUpperCase()}`);
          
          // Process data through custom decoder
          const packets = decoder.addData(data);
          
          for (const packet of packets) {
            try {
              // Store in database
              const packetId = await this.database.storePacket(packet, {
                ip: socket.remoteAddress,
                port: socket.remotePort
              });
              
              client.packetsReceived++;
              this.stats.totalPackets++;
              
              console.log(`📦 Packet ${packetId} stored:`, {
                protocol: packet.protocolName,
                terminalId: packet.terminalId,
                serialNumber: packet.serialNumber,
                hasGPS: !!(packet.latitude && packet.longitude),
                needsResponse: packet.needsResponse
              });
              
              // Send response if required
              if (packet.needsResponse) {
                const response = decoder.generateResponse(packet.serialNumber, packet.protocol);
                socket.write(response);
                console.log(`📤 Response sent to ${clientId}: ${response.toString('hex').toUpperCase()}`);
              }
              
            } catch (dbError) {
              console.error(`❌ Database error for packet:`, dbError);
            }
          }
          
        } catch (error) {
          console.error(`❌ Error processing data from ${clientId}:`, error);
        }
      });

      // Handle client disconnect
      socket.on('close', () => {
        console.log(`📱 Client disconnected: ${clientId}`);
        const client = this.clients.get(clientId);
        if (client) {
          console.log(`📊 Session stats for ${clientId}: ${client.packetsReceived} packets received`);
        }
        this.clients.delete(clientId);
      });

      // Handle socket errors
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Set socket timeout (30 minutes)
      socket.setTimeout(30 * 60 * 1000, () => {
        console.log(`⏰ Socket timeout for ${clientId}`);
        socket.destroy();
      });
    });

    // Handle server errors
    this.tcpServer.on('error', (error) => {
      console.error('❌ TCP Server error:', error);
    });

    // Start listening
    this.tcpServer.listen(TCP_PORT, TCP_HOST, () => {
      console.log(`🎯 TCP Server started on ${TCP_HOST}:${TCP_PORT}`);
    });
  }

  /**
   * Start Express API server for data access
   */
  startAPIServer() {
    const app = express();
    
    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req, res, next) => {
      console.log(`🌐 ${req.method} ${req.path} - ${req.ip}`);
      next();
    });

    // Server status endpoint
    app.get('/', (req, res) => {
      const uptime = Date.now() - this.stats.startTime.getTime();
      res.json({
        service: 'GT06 Comprehensive Protocol Decoder',
        version: '1.0.0',
        status: 'operational',
        uptime: Math.floor(uptime / 1000),
        stats: {
          ...this.stats,
          activeClients: this.clients.size,
          packetsPerSecond: this.stats.totalPackets / (uptime / 1000)
        },
        endpoints: {
          api: '/api',
          docs: '/api/docs',
          health: '/api/health'
        }
      });
    });

    // Real-time stats endpoint
    app.get('/stats', (req, res) => {
      const clientStats = Array.from(this.clients.entries()).map(([id, client]) => ({
        id,
        connectedAt: client.connectedAt,
        lastActivity: client.lastActivity,
        packetsReceived: client.packetsReceived
      }));

      res.json({
        server: this.stats,
        clients: clientStats,
        database: {
          path: this.database.dbPath,
          connected: !!this.database.db
        }
      });
    });

    // Mount API routes
    app.use('/api', setupAPIRoutes(this.database));

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        suggestion: 'Visit /api/docs for available endpoints'
      });
    });

    // Error handler
    app.use((error, req, res, next) => {
      console.error('❌ API Error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });

    // Start API server
    this.apiServer = app.listen(API_PORT, () => {
      console.log(`🌐 API Server started on port ${API_PORT}`);
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🔄 Shutting down GT06 server...');
    
    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      console.log(`📱 Closing connection: ${clientId}`);
      client.socket.destroy();
    }
    this.clients.clear();

    // Close TCP server
    if (this.tcpServer) {
      this.tcpServer.close(() => {
        console.log('📡 TCP Server closed');
      });
    }

    // Close API server
    if (this.apiServer) {
      this.apiServer.close(() => {
        console.log('🌐 API Server closed');
      });
    }

    // Close database connection
    try {
      await this.database.close();
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }

    console.log('✅ GT06 server shutdown complete');
  }
}

// Create and start server
const gt06Server = new GT06Server();

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('📨 Received SIGTERM signal');
  await gt06Server.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📨 Received SIGINT signal (Ctrl+C)');
  await gt06Server.shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gt06Server.shutdown().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gt06Server.shutdown().then(() => process.exit(1));
});

// Initialize server
gt06Server.init().catch((error) => {
  console.error('❌ Failed to start GT06 server:', error);
  process.exit(1);
});

module.exports = GT06Server;