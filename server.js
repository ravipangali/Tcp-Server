const net = require('net');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const GT06Decoder = require('./gt06_decoder');
const GT06Database = require('./database');
const setupAPIRoutes = require('./api_routes');

// Configuration
// const TCP_HOST = '84.247.131.246';
const TCP_HOST = '0.0.0.0';
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
          
          // Process decoded packets
          if (packets.length > 0) {
            for (let i = 0; i < packets.length; i++) {
              const packet = packets[i];
              
              // Store in database
              try {
                const packetId = await this.database.storePacket(packet, {
                  ip: socket.remoteAddress,
                  port: socket.remotePort
                });
                
                client.packetsReceived++;
                this.stats.totalPackets++;
                
                // Enhanced console logging with complete packet data
                console.log(`📦 Packet ${packetId} stored:`);
                console.log('┌─ BASIC INFO ─────────────────────────────────────────────────────────────┐');
                console.log(`│ Protocol: ${packet.protocolName} (0x${packet.protocol.toString(16).toUpperCase().padStart(2, '0')})`);
                console.log(`│ Terminal ID: ${packet.terminalId || 'N/A'}`);
                console.log(`│ Serial Number: ${packet.serialNumber}`);
                console.log(`│ Extended Packet: ${packet.isExtended ? 'Yes (7979)' : 'No (7878)'}`);
                console.log(`│ Timestamp: ${packet.timestamp.toISOString()}`);
                
                // GPS Information
                if (packet.latitude !== undefined && packet.longitude !== undefined) {
                  console.log('├─ GPS DATA ───────────────────────────────────────────────────────────────┤');
                  console.log(`│ 📍 Location: ${packet.latitude.toFixed(6)}, ${packet.longitude.toFixed(6)}`);
                  console.log(`│ 🛰️  Satellites: ${packet.satellites || 'N/A'}`);
                  console.log(`│ 🚗 Speed: ${packet.speed || 0} km/h`);
                  console.log(`│ 🧭 Course: ${packet.course || 0}°`);
                  console.log(`│ ⏰ GPS Time: ${packet.gpsTime ? packet.gpsTime.toISOString() : 'N/A'}`);
                  console.log(`│ 📡 GPS Status: ${packet.gpsPositioned ? '✅ Fixed' : '❌ No Fix'}`);
                  console.log(`│ 🕐 Real Time: ${packet.gpsRealTime ? '✅ Yes' : '❌ No'}`);
                } else {
                  console.log('├─ GPS DATA ───────────────────────────────────────────────────────────────┤');
                  console.log('│ 📍 Location: No GPS data in this packet');
                }
                
                // LBS (Cell Tower) Information
                if (packet.mcc !== undefined) {
                  console.log('├─ LBS DATA ───────────────────────────────────────────────────────────────┤');
                  console.log(`│ 📶 MCC: ${packet.mcc} | MNC: ${packet.mnc}`);
                  console.log(`│ 🏭 LAC: ${packet.lac} | Cell ID: ${packet.cellId}`);
                }
                
                // Device Status Information
                if (packet.terminalInfo) {
                  console.log('├─ DEVICE STATUS ──────────────────────────────────────────────────────────┤');
                  console.log(`│ 🔋 Battery: ${packet.terminalInfo.lowBattery ? '🔴 Low' : '🟢 Good'}`);
                  console.log(`│ 🔌 Charging: ${packet.terminalInfo.charging ? '⚡ Yes' : '🔌 No'}`);
                  console.log(`│ 🔑 Ignition (ACC): ${packet.terminalInfo.accHigh ? '🟢 ON' : '🔴 OFF'}`);
                  console.log(`│ 🛡️  Defense Mode: ${packet.terminalInfo.defence ? '🟢 ON' : '🔴 OFF'}`);
                  console.log(`│ 📍 GPS Tracking: ${packet.terminalInfo.gpsTracking ? '🟢 ON' : '🔴 OFF'}`);
                  console.log(`│ ⛽ Oil/Electricity: ${packet.terminalInfo.oilElectricity ? '🟢 ON' : '🔴 OFF'}`);
                  console.log(`│ 📶 GSM Signal: ${packet.terminalInfo.gsmSignal}/3`);
                  
                  if (packet.voltage) {
                    console.log(`│ ⚡ Voltage: ${packet.voltage.toFixed(2)}V`);
                  }
                  if (packet.gsmSignalStrength) {
                    console.log(`│ 📶 Signal Strength: ${packet.gsmSignalStrength}`);
                  }
                }
                
                // Alarm Information
                if (packet.alarmType) {
                  console.log('├─ ALARM DATA ─────────────────────────────────────────────────────────────┤');
                  const alarms = [];
                  if (packet.alarmType.emergency) alarms.push('🚨 Emergency');
                  if (packet.alarmType.overspeed) alarms.push('💨 Overspeed');
                  if (packet.alarmType.lowPower) alarms.push('🔋 Low Power');
                  if (packet.alarmType.shock) alarms.push('💥 Shock');
                  if (packet.alarmType.intoArea) alarms.push('📍 Enter Geofence');
                  if (packet.alarmType.outArea) alarms.push('📍 Exit Geofence');
                  if (packet.alarmType.longNoOperation) alarms.push('⏰ Long Idle');
                  if (packet.alarmType.distance) alarms.push('📏 Distance');
                  
                  if (alarms.length > 0) {
                    console.log(`│ Active Alarms: ${alarms.join(', ')}`);
                  } else {
                    console.log('│ 🟢 No active alarms');
                  }
                }
                
                // WiFi Information
                if (packet.wifiData && packet.wifiData.length > 0) {
                  console.log('├─ WIFI DATA ──────────────────────────────────────────────────────────────┤');
                  console.log(`│ 📶 WiFi Networks Found: ${packet.wifiData.length}`);
                  packet.wifiData.forEach((wifi, index) => {
                    console.log(`│   ${index + 1}. MAC: ${wifi.mac} | Signal: ${wifi.rssi} dBm`);
                  });
                }
                
                // Information Transmission Data
                if (packet.informationData) {
                  console.log('├─ INFORMATION DATA ───────────────────────────────────────────────────────┤');
                  console.log(`│ 📄 Data: ${packet.informationData.substring(0, 100)}${packet.informationData.length > 100 ? '...' : ''}`);
                }
                
                // ICCID Information
                if (packet.iccid) {
                  console.log('├─ SIM CARD DATA ──────────────────────────────────────────────────────────┤');
                  console.log(`│ 📱 ICCID: ${packet.iccid}`);
                }
                
                // Additional/Unknown Data
                if (packet.data) {
                  console.log('├─ RAW DATA ───────────────────────────────────────────────────────────────┤');
                  console.log(`│ 🔍 Hex: ${packet.data.substring(0, 60)}${packet.data.length > 60 ? '...' : ''}`);
                }
                
                console.log('└──────────────────────────────────────────────────────────────────────────┘');
                
                // Complete JSON Summary for easy parsing and debugging
                const completePacketData = {
                  packetId: packetId,
                  raw: packet.raw,
                  basic: {
                    protocol: packet.protocolName,
                    protocolCode: `0x${packet.protocol.toString(16).toUpperCase().padStart(2, '0')}`,
                    terminalId: packet.terminalId,
                    serialNumber: packet.serialNumber,
                    isExtended: packet.isExtended,
                    timestamp: packet.timestamp,
                    needsResponse: packet.needsResponse
                  },
                  gps: packet.latitude !== undefined && packet.longitude !== undefined ? {
                    latitude: packet.latitude,
                    longitude: packet.longitude,
                    speed: packet.speed || 0,
                    course: packet.course || 0,
                    satellites: packet.satellites || 0,
                    gpsTime: packet.gpsTime,
                    positioned: packet.gpsPositioned || false,
                    realTime: packet.gpsRealTime || false,
                    eastLongitude: packet.eastLongitude,
                    northLatitude: packet.northLatitude
                  } : null,
                  lbs: packet.mcc !== undefined ? {
                    mcc: packet.mcc,
                    mnc: packet.mnc,
                    lac: packet.lac,
                    cellId: packet.cellId
                  } : null,
                  deviceStatus: packet.terminalInfo ? {
                    battery: {
                      low: packet.terminalInfo.lowBattery,
                      charging: packet.terminalInfo.charging,
                      voltage: packet.voltage
                    },
                    vehicle: {
                      ignition: packet.terminalInfo.accHigh,
                      oilElectricity: packet.terminalInfo.oilElectricity
                    },
                    security: {
                      defenseMode: packet.terminalInfo.defence,
                      gpsTracking: packet.terminalInfo.gpsTracking
                    },
                    network: {
                      gsmSignal: packet.terminalInfo.gsmSignal,
                      gsmSignalStrength: packet.gsmSignalStrength
                    }
                  } : null,
                  alarms: packet.alarmType ? {
                    active: Object.keys(packet.alarmType).filter(key => packet.alarmType[key]),
                    details: packet.alarmType
                  } : null,
                  wifi: packet.wifiData && packet.wifiData.length > 0 ? {
                    count: packet.wifiData.length,
                    time: packet.wifiTime,
                    networks: packet.wifiData
                  } : null,
                  information: packet.informationData ? {
                    data: packet.informationData,
                    hex: packet.data
                  } : null,
                  sim: packet.iccid ? {
                    iccid: packet.iccid
                  } : null,
                  raw: packet.data ? {
                    hex: packet.data,
                    additionalData: packet.additionalData
                  } : null
                };

                console.log('🔍 COMPLETE PACKET DATA (JSON):');
                console.log(JSON.stringify(completePacketData, null, 2));
                console.log('═'.repeat(80));

                // Send response if required
                if (packet.needsResponse) {
                  const response = decoder.generateResponse(packet.serialNumber, packet.protocol);
                  socket.write(response);
                  console.log(`📤 Response sent to ${clientId}: ${response.toString('hex').toUpperCase()}`);
                }

              } catch (dbError) {
                console.error('❌ Database storage failed:', dbError.message);
              }
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