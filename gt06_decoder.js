const moment = require('moment');

class GT06Decoder {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.START_BITS = [0x78, 0x78];
    this.STOP_BITS = [0x0D, 0x0A];
    
    // Protocol command types
    this.PROTOCOL_NUMBERS = {
      0x01: 'LOGIN',
      0x02: 'GPS_POSITIONING',
      0x03: 'HEARTBEAT',
      0x04: 'TERMINAL_RESPONSE',
      0x05: 'TERMINAL_COMMAND',
      0x08: 'REQUEST_RESPONSE',
      0x10: 'GPS_LBS_STATUS',
      0x11: 'GPS_LBS_ALARM',
      0x12: 'GPS_LBS_STATUS_2',
      0x13: 'STATUS_INFO',
      0x15: 'STRING_INFO',
      0x16: 'ALARM_DATA',
      0x17: 'GPS_LBS_MULTIPLE',
      0x18: 'LBS_PHONE',
      0x19: 'GPS_LBS_EXTEND',
      0x1A: 'GPS_LBS_DATA',
      0x21: 'ONLINE_COMMAND',
      0x22: 'LOCATION_REQUEST',
      0x23: 'LOCATION_DATA',
      0x26: 'ALARM_DATA_26',
      0x27: 'TIME_REQUEST',
      0x28: 'INFO_TRANSMISSION',
      0x2A: 'PHOTO_DATA',
      0x30: 'WIFI_POSITIONING',
      0x31: 'MANUAL_POSITIONING',
      0x32: 'AUTOMATIC_POSITIONING',
      0x33: 'AGPS_REQUEST',
      0x34: 'AGPS_COMMAND',
      0x40: 'PERIPHERAL_SYSTEMS',
      0x41: 'FORWARD_MESSAGE',
      0x42: 'FORWARD_QUESTION',
      0x43: 'FORWARD_MONITOR',
      0x44: 'FORWARD_COMMAND',
      0x57: 'WIFI_OFFLINE',
      0x58: 'GPS_DRIVER_BEHAVIOR',
      0x69: 'ICCID_INFO',
      0x80: 'COMMAND_0X80',
      0x81: 'COMMAND_0X81',
      0x82: 'COMMAND_0X82',
      0x90: 'COMMAND_0X90',
      0x91: 'COMMAND_0X91',
      0x92: 'COMMAND_0X92',
      0x93: 'COMMAND_0X93',
      0x94: 'COMMAND_0X94',
      0x95: 'COMMAND_0X95'
    };

    // Response commands that require acknowledgment
    this.RESPONSE_REQUIRED = [0x01, 0x21, 0x15, 0x16, 0x18, 0x19];
  }

  /**
   * Add incoming data to buffer and process complete packets
   */
  addData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    return this.processBuffer();
  }

  /**
   * Process buffer and extract complete packets
   */
  processBuffer() {
    const packets = [];
    
    while (this.buffer.length >= 5) { // Minimum packet size
      const startIndex = this.findStartBits();
      
      if (startIndex === -1) {
        // No start bits found, clear buffer
        this.buffer = Buffer.alloc(0);
        break;
      }

      if (startIndex > 0) {
        // Remove data before start bits
        this.buffer = this.buffer.slice(startIndex);
      }

      if (this.buffer.length < 5) break;

      // Get packet length
      const lengthByte = this.buffer[2];
      const totalLength = lengthByte + 5; // +2 start, +1 length, +2 stop

      if (this.buffer.length < totalLength) break;

      // Extract packet
      const packet = this.buffer.slice(0, totalLength);
      
      // Verify stop bits
      if (packet[totalLength - 2] === 0x0D && packet[totalLength - 1] === 0x0A) {
        try {
          const decoded = this.decodePacket(packet);
          if (decoded) {
            packets.push(decoded);
          }
        } catch (error) {
          console.error('Error decoding packet:', error);
        }
      }

      // Remove processed packet from buffer
      this.buffer = this.buffer.slice(totalLength);
    }

    return packets;
  }

  /**
   * Find start bits in buffer
   */
  findStartBits() {
    for (let i = 0; i <= this.buffer.length - 2; i++) {
      if (this.buffer[i] === 0x78 && this.buffer[i + 1] === 0x78) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Decode a complete packet
   */
  decodePacket(packet) {
    if (packet.length < 5) return null;

    const result = {
      raw: packet.toString('hex').toUpperCase(),
      timestamp: new Date(),
      length: packet[2],
      protocol: packet[3],
      protocolName: this.PROTOCOL_NUMBERS[packet[3]] || 'UNKNOWN',
      serialNumber: packet.readUInt16BE(packet.length - 4),
      checksum: packet.readUInt16BE(packet.length - 2),
      needsResponse: this.RESPONSE_REQUIRED.includes(packet[3])
    };

    // Extract data payload (excluding start, length, protocol, serial, checksum, stop)
    const dataPayload = packet.slice(4, packet.length - 4);
    
    // Decode based on protocol type
    switch (packet[3]) {
      case 0x01:
        this.decodeLogin(dataPayload, result);
        break;
      case 0x10:
      case 0x11:
      case 0x12:
      case 0x22:
        this.decodeGPSLBS(dataPayload, result);
        break;
      case 0x13:
        this.decodeStatusInfo(dataPayload, result);
        break;
      case 0x16:
        this.decodeAlarmData(dataPayload, result);
        break;
      case 0x19:
        this.decodeGPSLBSExtend(dataPayload, result);
        break;
      case 0x1A:
        this.decodeGPSLBSData(dataPayload, result);
        break;
      case 0x30:
        this.decodeWifiPositioning(dataPayload, result);
        break;
      case 0x69:
        this.decodeICCID(dataPayload, result);
        break;
      default:
        result.data = dataPayload.toString('hex').toUpperCase();
        break;
    }

    return result;
  }

  /**
   * Decode login information
   */
  decodeLogin(data, result) {
    if (data.length >= 8) {
      result.terminalId = data.slice(0, 8).toString('hex').toUpperCase();
      result.deviceType = data.length > 8 ? data.readUInt16BE(8) : null;
      result.timezoneOffset = data.length > 10 ? data.readInt16BE(10) : null;
    }
  }

  /**
   * Decode GPS LBS positioning data
   */
  decodeGPSLBS(data, result) {
    if (data.length < 21) return;

    let offset = 0;
    
    // Date and time (6 bytes)
    const year = 2000 + data[offset];
    const month = data[offset + 1];
    const day = data[offset + 2];
    const hour = data[offset + 3];
    const minute = data[offset + 4];
    const second = data[offset + 5];
    offset += 6;

    result.gpsTime = moment(`${year}-${month}-${day} ${hour}:${minute}:${second}`, 'YYYY-MM-DD HH:mm:ss').toDate();

    // GPS Info Length
    const gpsInfoLength = data[offset];
    offset += 1;

    if (gpsInfoLength > 0 && offset + gpsInfoLength <= data.length) {
      // Satellites
      result.satellites = (data[offset] >> 4) & 0x0F;
      
      // Latitude (4 bytes)
      const latRaw = data.readUInt32BE(offset) & 0x0FFFFFFF;
      result.latitude = latRaw / 1800000.0;
      offset += 4;

      // Longitude (4 bytes)
      const lngRaw = data.readUInt32BE(offset);
      result.longitude = lngRaw / 1800000.0;
      offset += 4;

      // Speed
      result.speed = data[offset];
      offset += 1;

      // Course and status
      const courseStatus = data.readUInt16BE(offset);
      result.course = courseStatus & 0x03FF;
      result.gpsRealTime = (courseStatus & 0x2000) === 0;
      result.gpsPositioned = (courseStatus & 0x1000) === 0;
      result.eastLongitude = (courseStatus & 0x0800) === 0;
      result.northLatitude = (courseStatus & 0x0400) === 0;
      offset += 2;

      // Adjust longitude and latitude based on direction
      if (!result.eastLongitude) result.longitude = -result.longitude;
      if (!result.northLatitude) result.latitude = -result.latitude;
    }

    // LBS Info
    if (offset + 9 <= data.length) {
      result.mcc = data.readUInt16BE(offset);
      result.mnc = data[offset + 2];
      result.lac = data.readUInt16BE(offset + 3);
      result.cellId = data.readUInt32BE(offset + 5) >>> 8; // 3 bytes
      offset += 8;
    }

    // Additional data for extended protocols
    if (data.length > offset) {
      result.additionalData = data.slice(offset).toString('hex').toUpperCase();
    }
  }

  /**
   * Decode status information
   */
  decodeStatusInfo(data, result) {
    if (data.length >= 1) {
      const status = data[0];
      result.terminalInfo = {
        oilElectricity: (status & 0x01) !== 0,
        gpsTracking: (status & 0x02) !== 0,
        charging: (status & 0x04) !== 0,
        accHigh: (status & 0x08) !== 0,
        defence: (status & 0x10) !== 0,
        lowBattery: (status & 0x20) !== 0,
        gsmSignal: (status >> 6) & 0x03
      };
    }

    if (data.length >= 3) {
      result.voltage = data.readUInt16BE(1) / 100; // Convert to volts
    }

    if (data.length >= 4) {
      result.gsmSignalStrength = data[3];
    }

    if (data.length >= 6) {
      result.alarmLanguage = data.readUInt16BE(4);
    }
  }

  /**
   * Decode alarm data
   */
  decodeAlarmData(data, result) {
    if (data.length >= 1) {
      const alarmType = data[0];
      result.alarmType = {
        emergency: (alarmType & 0x01) !== 0,
        overspeed: (alarmType & 0x02) !== 0,
        lowPower: (alarmType & 0x04) !== 0,
        shock: (alarmType & 0x08) !== 0,
        intoArea: (alarmType & 0x10) !== 0,
        outArea: (alarmType & 0x20) !== 0,
        longNoOperation: (alarmType & 0x40) !== 0,
        distance: (alarmType & 0x80) !== 0
      };
    }

    // Decode GPS data if present
    if (data.length > 1) {
      this.decodeGPSLBS(data.slice(1), result);
    }
  }

  /**
   * Decode GPS LBS extended data
   */
  decodeGPSLBSExtend(data, result) {
    this.decodeGPSLBS(data, result);
    
    // Additional extended data processing can be added here
    if (data.length > 30) {
      result.extendedData = data.slice(30).toString('hex').toUpperCase();
    }
  }

  /**
   * Decode GPS LBS data packet
   */
  decodeGPSLBSData(data, result) {
    this.decodeGPSLBS(data, result);
  }

  /**
   * Decode WiFi positioning data
   */
  decodeWifiPositioning(data, result) {
    if (data.length < 6) return;

    let offset = 0;
    
    // Date and time
    const year = 2000 + data[offset];
    const month = data[offset + 1];
    const day = data[offset + 2];
    const hour = data[offset + 3];
    const minute = data[offset + 4];
    const second = data[offset + 5];
    offset += 6;

    result.wifiTime = moment(`${year}-${month}-${day} ${hour}:${minute}:${second}`, 'YYYY-MM-DD HH:mm:ss').toDate();

    if (data.length > offset) {
      result.wifiCount = data[offset];
      offset += 1;

      result.wifiData = [];
      for (let i = 0; i < result.wifiCount && offset + 7 <= data.length; i++) {
        const mac = data.slice(offset, offset + 6).toString('hex').toUpperCase();
        const rssi = data[offset + 6];
        result.wifiData.push({ mac, rssi });
        offset += 7;
      }
    }
  }

  /**
   * Decode ICCID information
   */
  decodeICCID(data, result) {
    if (data.length >= 10) {
      // ICCID is typically 20 digits, stored as 10 bytes BCD
      let iccid = '';
      for (let i = 0; i < 10; i++) {
        const byte = data[i];
        iccid += ((byte & 0x0F).toString()) + ((byte >> 4).toString());
      }
      result.iccid = iccid;
    }
  }

  /**
   * Generate response packet for protocols that require acknowledgment
   */
  generateResponse(serialNumber, protocolNumber) {
    const response = Buffer.alloc(10);
    let offset = 0;

    // Start bits
    response[offset++] = 0x78;
    response[offset++] = 0x78;

    // Length
    response[offset++] = 0x05;

    // Protocol number
    response[offset++] = protocolNumber;

    // Serial number
    response.writeUInt16BE(serialNumber, offset);
    offset += 2;

    // CRC (simplified - in real implementation should calculate proper CRC)
    const crc = this.calculateCRC(response.slice(2, offset));
    response.writeUInt16BE(crc, offset);
    offset += 2;

    // Stop bits
    response[offset++] = 0x0D;
    response[offset++] = 0x0A;

    return response;
  }

  /**
   * Calculate CRC for packet (simplified implementation)
   */
  calculateCRC(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >> 1) ^ 0x8408;
        } else {
          crc >>= 1;
        }
      }
    }
    return (~crc) & 0xFFFF;
  }

  /**
   * Clear internal buffer
   */
  clearBuffer() {
    this.buffer = Buffer.alloc(0);
  }
}

module.exports = GT06Decoder; 