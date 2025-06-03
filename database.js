const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class GT06Database {
  constructor(dbPath = './gt06_data.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.init();
  }

  /**
   * Initialize database connection and create tables
   */
  init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  /**
   * Create database tables
   */
  createTables() {
    return new Promise((resolve, reject) => {
      // Main packets table
      const createPacketsTable = `
        CREATE TABLE IF NOT EXISTS packets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          raw TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          length INTEGER,
          protocol INTEGER,
          protocol_name TEXT,
          serial_number INTEGER,
          checksum INTEGER,
          needs_response BOOLEAN,
          terminal_id TEXT,
          device_type INTEGER,
          timezone_offset INTEGER,
          client_ip TEXT,
          client_port INTEGER
        )
      `;

      // GPS positioning data table
      const createGPSTable = `
        CREATE TABLE IF NOT EXISTS gps_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          packet_id INTEGER,
          gps_time DATETIME,
          latitude REAL,
          longitude REAL,
          speed INTEGER,
          course INTEGER,
          satellites INTEGER,
          gps_real_time BOOLEAN,
          gps_positioned BOOLEAN,
          east_longitude BOOLEAN,
          north_latitude BOOLEAN,
          FOREIGN KEY (packet_id) REFERENCES packets (id)
        )
      `;

      // LBS (Location Based Service) data table
      const createLBSTable = `
        CREATE TABLE IF NOT EXISTS lbs_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          packet_id INTEGER,
          mcc INTEGER,
          mnc INTEGER,
          lac INTEGER,
          cell_id INTEGER,
          FOREIGN KEY (packet_id) REFERENCES packets (id)
        )
      `;

      // Status information table
      const createStatusTable = `
        CREATE TABLE IF NOT EXISTS status_info (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          packet_id INTEGER,
          oil_electricity BOOLEAN,
          gps_tracking BOOLEAN,
          charging BOOLEAN,
          acc_high BOOLEAN,
          defence BOOLEAN,
          low_battery BOOLEAN,
          gsm_signal INTEGER,
          voltage REAL,
          gsm_signal_strength INTEGER,
          alarm_language INTEGER,
          FOREIGN KEY (packet_id) REFERENCES packets (id)
        )
      `;

      // Alarm data table
      const createAlarmTable = `
        CREATE TABLE IF NOT EXISTS alarm_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          packet_id INTEGER,
          emergency BOOLEAN,
          overspeed BOOLEAN,
          low_power BOOLEAN,
          shock BOOLEAN,
          into_area BOOLEAN,
          out_area BOOLEAN,
          long_no_operation BOOLEAN,
          distance BOOLEAN,
          FOREIGN KEY (packet_id) REFERENCES packets (id)
        )
      `;

      // WiFi positioning data table
      const createWifiTable = `
        CREATE TABLE IF NOT EXISTS wifi_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          packet_id INTEGER,
          wifi_time DATETIME,
          wifi_count INTEGER,
          FOREIGN KEY (packet_id) REFERENCES packets (id)
        )
      `;

      // WiFi access points table
      const createWifiAPTable = `
        CREATE TABLE IF NOT EXISTS wifi_access_points (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wifi_data_id INTEGER,
          mac_address TEXT,
          rssi INTEGER,
          FOREIGN KEY (wifi_data_id) REFERENCES wifi_data (id)
        )
      `;

      // Device sessions table
      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS device_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          terminal_id TEXT,
          session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
          session_end DATETIME,
          client_ip TEXT,
          client_port INTEGER,
          last_heartbeat DATETIME,
          total_packets INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active'
        )
      `;

      // Create indexes for better performance
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_packets_timestamp ON packets(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_packets_terminal_id ON packets(terminal_id)',
        'CREATE INDEX IF NOT EXISTS idx_packets_protocol ON packets(protocol)',
        'CREATE INDEX IF NOT EXISTS idx_gps_time ON gps_data(gps_time)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_terminal_id ON device_sessions(terminal_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_status ON device_sessions(status)'
      ];

      const tables = [
        createPacketsTable,
        createGPSTable,
        createLBSTable,
        createStatusTable,
        createAlarmTable,
        createWifiTable,
        createWifiAPTable,
        createSessionsTable,
        ...createIndexes
      ];

      let completed = 0;
      const total = tables.length;

      tables.forEach((sql) => {
        this.db.run(sql, (err) => {
          if (err) {
            console.error('Error creating table:', err);
            reject(err);
            return;
          }
          completed++;
          if (completed === total) {
            console.log('All database tables created successfully');
            resolve();
          }
        });
      });
    });
  }

  /**
   * Store decoded packet data
   */
  async storePacket(decodedData, clientInfo = {}) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO packets (
          raw, timestamp, length, protocol, protocol_name, serial_number, 
          checksum, needs_response, terminal_id, device_type, timezone_offset,
          client_ip, client_port
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        decodedData.raw,
        decodedData.timestamp,
        decodedData.length,
        decodedData.protocol,
        decodedData.protocolName,
        decodedData.serialNumber,
        decodedData.checksum,
        decodedData.needsResponse ? 1 : 0,
        decodedData.terminalId || null,
        decodedData.deviceType || null,
        decodedData.timezoneOffset || null,
        clientInfo.ip || null,
        clientInfo.port || null
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Error storing packet:', err);
          reject(err);
          return;
        }

        const packetId = this.lastID;
        
        // Store related data based on packet type
        const promises = [];

        // GPS data
        if (decodedData.latitude !== undefined && decodedData.longitude !== undefined) {
          promises.push(this.storeGPSData(packetId, decodedData));
        }

        // LBS data
        if (decodedData.mcc !== undefined) {
          promises.push(this.storeLBSData(packetId, decodedData));
        }

        // Status info
        if (decodedData.terminalInfo) {
          promises.push(this.storeStatusInfo(packetId, decodedData));
        }

        // Alarm data
        if (decodedData.alarmType) {
          promises.push(this.storeAlarmData(packetId, decodedData));
        }

        // WiFi data
        if (decodedData.wifiData) {
          promises.push(this.storeWifiData(packetId, decodedData));
        }

        // Update device session
        if (decodedData.terminalId) {
          promises.push(this.updateDeviceSession(decodedData.terminalId, clientInfo));
        }

        Promise.all(promises.map(p => p.catch(e => console.error('Related data error:', e))))
          .then(() => resolve(packetId))
          .catch(reject);

      }.bind(this));
    });
  }

  /**
   * Store GPS positioning data
   */
  storeGPSData(packetId, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO gps_data (
          packet_id, gps_time, latitude, longitude, speed, course, satellites,
          gps_real_time, gps_positioned, east_longitude, north_latitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        packetId,
        data.gpsTime || null,
        data.latitude || null,
        data.longitude || null,
        data.speed || null,
        data.course || null,
        data.satellites || null,
        data.gpsRealTime ? 1 : 0,
        data.gpsPositioned ? 1 : 0,
        data.eastLongitude ? 1 : 0,
        data.northLatitude ? 1 : 0
      ];

      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Store LBS data
   */
  storeLBSData(packetId, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO lbs_data (packet_id, mcc, mnc, lac, cell_id)
        VALUES (?, ?, ?, ?, ?)
      `;

      const params = [
        packetId,
        data.mcc || null,
        data.mnc || null,
        data.lac || null,
        data.cellId || null
      ];

      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Store status information
   */
  storeStatusInfo(packetId, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO status_info (
          packet_id, oil_electricity, gps_tracking, charging, acc_high,
          defence, low_battery, gsm_signal, voltage, gsm_signal_strength, alarm_language
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const info = data.terminalInfo;
      const params = [
        packetId,
        info.oilElectricity ? 1 : 0,
        info.gpsTracking ? 1 : 0,
        info.charging ? 1 : 0,
        info.accHigh ? 1 : 0,
        info.defence ? 1 : 0,
        info.lowBattery ? 1 : 0,
        info.gsmSignal || null,
        data.voltage || null,
        data.gsmSignalStrength || null,
        data.alarmLanguage || null
      ];

      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Store alarm data
   */
  storeAlarmData(packetId, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO alarm_data (
          packet_id, emergency, overspeed, low_power, shock,
          into_area, out_area, long_no_operation, distance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const alarm = data.alarmType;
      const params = [
        packetId,
        alarm.emergency ? 1 : 0,
        alarm.overspeed ? 1 : 0,
        alarm.lowPower ? 1 : 0,
        alarm.shock ? 1 : 0,
        alarm.intoArea ? 1 : 0,
        alarm.outArea ? 1 : 0,
        alarm.longNoOperation ? 1 : 0,
        alarm.distance ? 1 : 0
      ];

      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Store WiFi positioning data
   */
  storeWifiData(packetId, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO wifi_data (packet_id, wifi_time, wifi_count)
        VALUES (?, ?, ?)
      `;

      const params = [
        packetId,
        data.wifiTime || null,
        data.wifiCount || 0
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }

        const wifiDataId = this.lastID;
        
        // Store WiFi access points
        if (data.wifiData && data.wifiData.length > 0) {
          const apPromises = data.wifiData.map(ap => {
            return new Promise((apResolve, apReject) => {
              const apSql = `
                INSERT INTO wifi_access_points (wifi_data_id, mac_address, rssi)
                VALUES (?, ?, ?)
              `;
              this.db.run(apSql, [wifiDataId, ap.mac, ap.rssi], (apErr) => {
                if (apErr) apReject(apErr);
                else apResolve();
              });
            });
          });

          Promise.all(apPromises).then(() => resolve()).catch(reject);
        } else {
          resolve();
        }
      }.bind(this));
    });
  }

  /**
   * Update device session
   */
  updateDeviceSession(terminalId, clientInfo) {
    return new Promise((resolve, reject) => {
      // First, check if there's an active session
      const checkSql = `
        SELECT id FROM device_sessions 
        WHERE terminal_id = ? AND status = 'active'
        ORDER BY session_start DESC LIMIT 1
      `;

      this.db.get(checkSql, [terminalId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          // Update existing session
          const updateSql = `
            UPDATE device_sessions 
            SET last_heartbeat = CURRENT_TIMESTAMP, 
                total_packets = total_packets + 1
            WHERE id = ?
          `;
          this.db.run(updateSql, [row.id], (updateErr) => {
            if (updateErr) reject(updateErr);
            else resolve();
          });
        } else {
          // Create new session
          const insertSql = `
            INSERT INTO device_sessions (terminal_id, client_ip, client_port, last_heartbeat, total_packets)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)
          `;
          this.db.run(insertSql, [terminalId, clientInfo.ip, clientInfo.port], (insertErr) => {
            if (insertErr) reject(insertErr);
            else resolve();
          });
        }
      });
    });
  }

  /**
   * Get packets with pagination and filtering
   */
  getPackets(options = {}) {
    return new Promise((resolve, reject) => {
      const {
        limit = 50,
        offset = 0,
        terminalId,
        protocolName,
        startDate,
        endDate,
        orderBy = 'timestamp',
        orderDirection = 'DESC'
      } = options;

      let sql = 'SELECT * FROM packets WHERE 1=1';
      const params = [];

      if (terminalId) {
        sql += ' AND terminal_id = ?';
        params.push(terminalId);
      }

      if (protocolName) {
        sql += ' AND protocol_name = ?';
        params.push(protocolName);
      }

      if (startDate) {
        sql += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        sql += ' AND timestamp <= ?';
        params.push(endDate);
      }

      sql += ` ORDER BY ${orderBy} ${orderDirection} LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get GPS tracking data
   */
  getGPSData(options = {}) {
    return new Promise((resolve, reject) => {
      const {
        terminalId,
        startDate,
        endDate,
        limit = 100
      } = options;

      let sql = `
        SELECT p.terminal_id, p.timestamp, g.gps_time, g.latitude, g.longitude, 
               g.speed, g.course, g.satellites, g.gps_positioned
        FROM packets p
        JOIN gps_data g ON p.id = g.packet_id
        WHERE g.latitude IS NOT NULL AND g.longitude IS NOT NULL
      `;
      const params = [];

      if (terminalId) {
        sql += ' AND p.terminal_id = ?';
        params.push(terminalId);
      }

      if (startDate) {
        sql += ' AND p.timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        sql += ' AND p.timestamp <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY p.timestamp DESC LIMIT ?';
      params.push(limit);

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get device statistics
   */
  getDeviceStats(terminalId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_packets,
          COUNT(DISTINCT DATE(timestamp)) as active_days,
          MIN(timestamp) as first_seen,
          MAX(timestamp) as last_seen,
          (SELECT COUNT(*) FROM gps_data g JOIN packets p ON g.packet_id = p.id WHERE p.terminal_id = ?) as gps_packets,
          (SELECT COUNT(*) FROM alarm_data a JOIN packets p ON a.packet_id = p.id WHERE p.terminal_id = ?) as alarm_packets
        FROM packets 
        WHERE terminal_id = ?
      `;

      this.db.get(sql, [terminalId, terminalId, terminalId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get active device sessions
   */
  getActiveSessions() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM device_sessions 
        WHERE status = 'active'
        ORDER BY last_heartbeat DESC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = GT06Database; 