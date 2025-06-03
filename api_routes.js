const express = require('express');
const router = express.Router();

/**
 * Set up API routes for GT06 data
 * @param {GT06Database} database - Database instance
 */
function setupRoutes(database) {
  
  // Get all packets with pagination and filtering
  router.get('/packets', async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        terminalId,
        protocolName,
        startDate,
        endDate,
        orderBy = 'timestamp',
        orderDirection = 'DESC'
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const options = {
        limit: parseInt(limit),
        offset,
        terminalId,
        protocolName,
        startDate,
        endDate,
        orderBy,
        orderDirection
      };

      const packets = await database.getPackets(options);
      
      res.json({
        success: true,
        data: packets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: packets.length === parseInt(limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve packets',
        details: error.message
      });
    }
  });

  // Get specific packet by ID with related data
  router.get('/packets/:id', async (req, res) => {
    try {
      const packetId = req.params.id;
      
      // Get main packet data
      const packets = await database.getPackets({ 
        limit: 1, 
        offset: 0,
        // Add a custom where clause for ID (you may need to modify getPackets method)
      });
      
      if (packets.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Packet not found'
        });
      }

      const packet = packets[0];
      
      // Get related data based on packet type
      const relatedData = {};
      
      // You can extend this to get GPS, LBS, alarm data etc. for this specific packet
      
      res.json({
        success: true,
        data: {
          packet,
          related: relatedData
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve packet',
        details: error.message
      });
    }
  });

  // Get GPS tracking data
  router.get('/gps', async (req, res) => {
    try {
      const {
        terminalId,
        startDate,
        endDate,
        limit = 100
      } = req.query;

      const options = {
        terminalId,
        startDate,
        endDate,
        limit: parseInt(limit)
      };

      const gpsData = await database.getGPSData(options);
      
      res.json({
        success: true,
        data: gpsData,
        count: gpsData.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve GPS data',
        details: error.message
      });
    }
  });

  // Get GPS tracking data in GeoJSON format
  router.get('/gps/geojson', async (req, res) => {
    try {
      const {
        terminalId,
        startDate,
        endDate,
        limit = 100
      } = req.query;

      const options = {
        terminalId,
        startDate,
        endDate,
        limit: parseInt(limit)
      };

      const gpsData = await database.getGPSData(options);
      
      // Convert to GeoJSON format
      const geoJSON = {
        type: "FeatureCollection",
        features: gpsData.map(point => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [point.longitude, point.latitude]
          },
          properties: {
            terminal_id: point.terminal_id,
            timestamp: point.timestamp,
            gps_time: point.gps_time,
            speed: point.speed,
            course: point.course,
            satellites: point.satellites,
            gps_positioned: point.gps_positioned
          }
        }))
      };
      
      res.json({
        success: true,
        data: geoJSON
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve GPS GeoJSON data',
        details: error.message
      });
    }
  });

  // Get device statistics
  router.get('/devices/:terminalId/stats', async (req, res) => {
    try {
      const { terminalId } = req.params;
      const stats = await database.getDeviceStats(terminalId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve device statistics',
        details: error.message
      });
    }
  });

  // Get active device sessions
  router.get('/sessions', async (req, res) => {
    try {
      const sessions = await database.getActiveSessions();
      
      res.json({
        success: true,
        data: sessions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve active sessions',
        details: error.message
      });
    }
  });

  // Get protocol statistics
  router.get('/stats/protocols', async (req, res) => {
    try {
      // This would require a custom query to get protocol statistics
      // For now, return a placeholder
      res.json({
        success: true,
        data: {
          message: "Protocol statistics endpoint - implementation depends on specific requirements"
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve protocol statistics',
        details: error.message
      });
    }
  });

  // Get dashboard overview
  router.get('/dashboard', async (req, res) => {
    try {
      const sessions = await database.getActiveSessions();
      
      // You can extend this to get more dashboard data
      const overview = {
        activeSessions: sessions.length,
        totalDevices: sessions.length, // Simplified
        lastUpdate: new Date().toISOString()
      };
      
      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard data',
        details: error.message
      });
    }
  });

  // Get devices list
  router.get('/devices', async (req, res) => {
    try {
      const sessions = await database.getActiveSessions();
      
      // Transform sessions into device list
      const devices = sessions.map(session => ({
        terminalId: session.terminal_id,
        status: session.status,
        lastSeen: session.last_heartbeat,
        sessionStart: session.session_start,
        totalPackets: session.total_packets,
        clientInfo: {
          ip: session.client_ip,
          port: session.client_port
        }
      }));
      
      res.json({
        success: true,
        data: devices
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve devices list',
        details: error.message
      });
    }
  });

  // Search packets by raw data
  router.get('/search', async (req, res) => {
    try {
      const { q, type = 'raw' } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }

      // This is a simplified search - you'd want to implement proper search functionality
      // based on your specific requirements
      
      res.json({
        success: true,
        data: {
          query: q,
          type: type,
          results: [],
          message: "Search functionality - implement based on specific requirements"
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Search failed',
        details: error.message
      });
    }
  });

  // Get alarm data
  router.get('/alarms', async (req, res) => {
    try {
      const {
        terminalId,
        startDate,
        endDate,
        alarmType
      } = req.query;

      // This would require a custom query to get alarm data
      // For now, return a placeholder response
      
      res.json({
        success: true,
        data: {
          message: "Alarm data endpoint - requires custom query implementation",
          filters: {
            terminalId,
            startDate,
            endDate,
            alarmType
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alarm data',
        details: error.message
      });
    }
  });

  // Export data in different formats
  router.get('/export/:format', async (req, res) => {
    try {
      const { format } = req.params;
      const {
        terminalId,
        startDate,
        endDate,
        dataType = 'packets'
      } = req.query;

      if (!['json', 'csv', 'xml'].includes(format)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported export format. Use: json, csv, xml'
        });
      }

      // Get data based on type
      let data;
      if (dataType === 'gps') {
        data = await database.getGPSData({ terminalId, startDate, endDate });
      } else {
        data = await database.getPackets({ terminalId, startDate, endDate, limit: 1000 });
      }

      // Set appropriate headers based on format
      switch (format) {
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="${dataType}_data.csv"`);
          // Convert to CSV (simplified)
          const csvHeaders = Object.keys(data[0] || {}).join(',');
          const csvRows = data.map(row => Object.values(row).join(','));
          res.send([csvHeaders, ...csvRows].join('\n'));
          break;
          
        case 'xml':
          res.setHeader('Content-Type', 'application/xml');
          res.setHeader('Content-Disposition', `attachment; filename="${dataType}_data.xml"`);
          // Convert to XML (simplified)
          const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  ${data.map(item => `<item>${JSON.stringify(item)}</item>`).join('\n  ')}
</data>`;
          res.send(xmlData);
          break;
          
        default: // json
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${dataType}_data.json"`);
          res.json({
            success: true,
            data: data,
            exported_at: new Date().toISOString(),
            filters: { terminalId, startDate, endDate, dataType }
          });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Export failed',
        details: error.message
      });
    }
  });

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'GT06 Protocol Decoder API'
    });
  });

  // API documentation endpoint
  router.get('/docs', (req, res) => {
    const endpoints = [
      { method: 'GET', path: '/api/packets', description: 'Get all packets with pagination and filtering' },
      { method: 'GET', path: '/api/packets/:id', description: 'Get specific packet by ID' },
      { method: 'GET', path: '/api/gps', description: 'Get GPS tracking data' },
      { method: 'GET', path: '/api/gps/geojson', description: 'Get GPS data in GeoJSON format' },
      { method: 'GET', path: '/api/devices/:terminalId/stats', description: 'Get device statistics' },
      { method: 'GET', path: '/api/sessions', description: 'Get active device sessions' },
      { method: 'GET', path: '/api/devices', description: 'Get devices list' },
      { method: 'GET', path: '/api/dashboard', description: 'Get dashboard overview' },
      { method: 'GET', path: '/api/search', description: 'Search packets' },
      { method: 'GET', path: '/api/alarms', description: 'Get alarm data' },
      { method: 'GET', path: '/api/export/:format', description: 'Export data (json/csv/xml)' },
      { method: 'GET', path: '/api/health', description: 'Health check' },
      { method: 'GET', path: '/api/docs', description: 'API documentation' }
    ];

    res.json({
      success: true,
      title: 'GT06 Protocol Decoder API Documentation',
      version: '1.0.0',
      endpoints: endpoints
    });
  });

  return router;
}

module.exports = setupRoutes; 