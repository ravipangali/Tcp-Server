const moment = require('moment');

class GT06Decoder {
  constructor() {
    this.buffer = Buffer.alloc(0);
    // GT06 protocol supports both start bit patterns
    this.START_BITS_78 = [0x78, 0x78];  // Standard packets
    this.START_BITS_79 = [0x79, 0x79];  // Extended packets
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
      0x70: 'LOCATION_REPORTING',
      0x80: 'COMMAND_0X80',
      0x81: 'COMMAND_0X81',
      0x82: 'COMMAND_0X82',
      0x8A: 'GPS_LBS_STATUS_8A',
      0x90: 'COMMAND_0X90',
      0x91: 'COMMAND_0X91',
      0x92: 'COMMAND_0X92',
      0x93: 'COMMAND_0X93',
      0x94: 'INFORMATION_TRANSMISSION',
      0x95: 'COMMAND_0X95',
      0x98: 'COMMAND_0X98',
      0x99: 'COMMAND_0X99',
      0xA0: 'GPS_LBS_STATUS_A0'
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
      const startInfo = this.findStartBits();
      
      if (startInfo.index === -1) {
        // No start bits found, clear buffer
        this.buffer = Buffer.alloc(0);
        break;
      }

      if (startInfo.index > 0) {
        // Remove data before start bits
        this.buffer = this.buffer.slice(startInfo.index);
      }

      if (this.buffer.length < 5) break;

      // Get packet length - for 7979 packets, length is in different position
      let lengthByte, totalLength;
      
      if (startInfo.isExtended) {
        // 7979 packets: [79 79] [length MSB] [length LSB] [protocol] [data...] [0D] [0A]
        // The length field includes protocol + data but not start bits or stop bits
        if (this.buffer.length < 6) break;
        lengthByte = this.buffer.readUInt16BE(2); // 2-byte length for extended packets
        totalLength = lengthByte + 6; // +2 start, +2 length, +2 stop
      } else {
        // 7878 packets: [78 78] [length] [protocol] [data...] [serial MSB] [serial LSB] [crc MSB] [crc LSB] [0D] [0A]
        lengthByte = this.buffer[2];
        totalLength = lengthByte + 5; // +2 start, +1 length, +2 stop (length includes everything from protocol to crc)
      }

      if (this.buffer.length < totalLength) break;

      // Extract packet
      const packet = this.buffer.slice(0, totalLength);
      
      // Verify stop bits
      if (packet[totalLength - 2] === 0x0D && packet[totalLength - 1] === 0x0A) {
        try {
          const decoded = this.decodePacket(packet, startInfo.isExtended);
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
   * Find start bits in buffer - handles both 7878 and 7979
   */
  findStartBits() {
    for (let i = 0; i <= this.buffer.length - 2; i++) {
      // Check for 7878 start bits
      if (this.buffer[i] === 0x78 && this.buffer[i + 1] === 0x78) {
        return { index: i, isExtended: false };
      }
      // Check for 7979 start bits (extended packets)
      if (this.buffer[i] === 0x79 && this.buffer[i + 1] === 0x79) {
        return { index: i, isExtended: true };
      }
    }
    return { index: -1, isExtended: false };
  }

  /**
   * Decode a complete packet
   */
  decodePacket(packet, isExtended = false) {
    if (packet.length < 5) return null;

    let protocolOffset, dataStartOffset, serialOffset, checksumOffset;
    
    if (isExtended) {
      // 7979 packet structure: [79 79] [length MSB] [length LSB] [protocol] [data...] [0D] [0A]
      // No separate serial number or CRC fields in this format
      protocolOffset = 4;
      dataStartOffset = 5;
      serialOffset = -1; // No serial in this format
      checksumOffset = -1; // No checksum in this format
    } else {
      // 7878 packet structure: [78 78] [length] [protocol] [data...] [serial MSB] [serial LSB] [crc MSB] [crc LSB] [0D] [0A]
      protocolOffset = 3;
      dataStartOffset = 4;
      serialOffset = packet.length - 6; // Serial is 2 bytes before stop bits (0D 0A)
      checksumOffset = packet.length - 4; // CRC is immediately after serial
    }

    const result = {
      raw: packet.toString('hex').toUpperCase(),
      timestamp: new Date(),
      length: isExtended ? packet.readUInt16BE(2) : packet[2],
      protocol: packet[protocolOffset],
      protocolName: this.PROTOCOL_NUMBERS[packet[protocolOffset]] || 'UNKNOWN',
      serialNumber: serialOffset >= 0 ? packet.readUInt16BE(serialOffset) : 0,
      checksum: checksumOffset >= 0 ? packet.readUInt16BE(checksumOffset) : 0,
      needsResponse: this.RESPONSE_REQUIRED.includes(packet[protocolOffset]),
      isExtended: isExtended
    };

    // Extract data payload (excluding start, length, protocol, serial, checksum, stop)
    let dataPayload;
    if (isExtended) {
      // For 7979, data goes from protocol+1 to end-2 (excluding stop bits)
      dataPayload = packet.slice(dataStartOffset, packet.length - 2);
    } else {
      // For 7878, data goes from protocol+1 to serial
      dataPayload = packet.slice(dataStartOffset, serialOffset);
    }
    
    // Decode based on protocol type
    switch (packet[protocolOffset]) {
      case 0x01:
        this.decodeLogin(dataPayload, result);
        break;
      case 0x10:
      case 0x11:
      case 0x12:
      case 0x22:
      case 0xA0:
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
      case 0x70:
        this.decodeLocationReporting(dataPayload, result);
        break;
      case 0x8A:
        this.decodeStatusCommand(dataPayload, result);
        break;
      case 0x94:
        this.decodeInformationTransmission(dataPayload, result);
        break;
      case 0x98:
      case 0x99:
        this.decodeExtendedCommand(dataPayload, result);
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
    if (data.length < 12) return; // Minimum data required

    let offset = 0;
    
    // Date and time (6 bytes)
    if (data.length >= 6) {
      const year = 2000 + data[offset];
      const month = data[offset + 1];
      const day = data[offset + 2];
      const hour = data[offset + 3];
      const minute = data[offset + 4];
      const second = data[offset + 5];
      offset += 6;

      // Validate date/time values
      if (year >= 2000 && year <= 2050 && month >= 1 && month <= 12 && 
          day >= 1 && day <= 31 && hour <= 23 && minute <= 59 && second <= 59) {
        result.gpsTime = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`, 'YYYY-MM-DD HH:mm:ss').toDate();
      }
    }

    // Check if this is an A0 protocol packet (different structure)
    if (result.protocol === 0xA0) {
      // For A0 packets, the structure is different after timestamp
      // Skip GPS Info Length byte and parse directly
      if (offset < data.length) {
        // Skip the first byte (it's not GPS info length for A0)
        offset += 1;
        
        // Parse GPS coordinates directly from the known structure
        if (offset + 12 <= data.length) {
          // Parse latitude (4 bytes) at offset
          const latBytes = data.slice(offset, offset + 4);
          const latRaw = latBytes.readUInt32BE(0);
          
          if (latRaw > 0 && latRaw < 0xFFFFFFFF) {
            result.latitude = latRaw / 1800000.0;
          }
          offset += 4;
          
          // Parse longitude (4 bytes)
          const lngBytes = data.slice(offset, offset + 4);
          const lngRaw = lngBytes.readUInt32BE(0);
          
          if (lngRaw > 0 && lngRaw < 0xFFFFFFFF) {
            result.longitude = lngRaw / 1800000.0;
          }
          offset += 4;
          
          // Speed and course
          if (offset + 3 <= data.length) {
            result.speed = data[offset];
            const courseStatus = data.readUInt16BE(offset + 1);
            result.course = courseStatus & 0x03FF;
            
            // Status flags
            result.gpsRealTime = (courseStatus & 0x2000) === 0;
            result.gpsPositioned = (courseStatus & 0x1000) === 0;
            result.eastLongitude = (courseStatus & 0x0800) === 0;
            result.northLatitude = (courseStatus & 0x0400) === 0;
            
            // Adjust coordinates based on hemisphere flags
            if (result.longitude !== undefined && !result.eastLongitude) {
              result.longitude = -result.longitude;
            }
            if (result.latitude !== undefined && !result.northLatitude) {
              result.latitude = -result.latitude;
            }
            
            offset += 3;
          }
        }
        
        // Parse LBS data for A0 (might be at a different offset)
        while (offset + 9 <= data.length) {
          const testMCC = data.readUInt16BE(offset);
          // Look for reasonable MCC values (100-999)
          if (testMCC >= 100 && testMCC <= 999) {
            result.mcc = testMCC;
            result.mnc = data[offset + 2];
            result.lac = data.readUInt16BE(offset + 3);
            
            const cellId1 = data[offset + 5];
            const cellId2 = data[offset + 6];
            const cellId3 = data[offset + 7];
            result.cellId = (cellId1 << 16) | (cellId2 << 8) | cellId3;
            
            offset += 8;
            break;
          }
          offset += 1;
        }
      }
    } else {
      // Original GPS LBS parsing for other protocols
      if (offset < data.length) {
        const gpsInfoLength = data[offset];
        offset += 1;

        if (gpsInfoLength > 0 && gpsInfoLength <= 50 && offset + gpsInfoLength <= data.length) {
          // GPS data present - extract coordinates
          
          // Satellites and latitude (4 bytes)
          if (offset + 4 <= data.length) {
            result.satellites = (data[offset] >> 4) & 0x0F;
            
            const lat1 = data[offset] & 0x0F;
            const lat2 = data[offset + 1];
            const lat3 = data[offset + 2];
            const lat4 = data[offset + 3];
            
            const latRaw = (lat1 << 24) | (lat2 << 16) | (lat3 << 8) | lat4;
            
            if (latRaw > 0) {
              result.latitude = latRaw / 1800000.0;
            }
            offset += 4;
          }

          // Longitude (4 bytes)
          if (offset + 4 <= data.length) {
            const lngRaw = data.readUInt32BE(offset);
            
            if (lngRaw > 0) {
              result.longitude = lngRaw / 1800000.0;
            }
            offset += 4;
          }

          // Speed and course
          if (offset < data.length) {
            result.speed = data[offset];
            offset += 1;
          }

          if (offset + 2 <= data.length) {
            const courseStatus = data.readUInt16BE(offset);
            
            result.course = courseStatus & 0x03FF;
            result.gpsRealTime = (courseStatus & 0x2000) === 0;
            result.gpsPositioned = (courseStatus & 0x1000) === 0;
            result.eastLongitude = (courseStatus & 0x0800) === 0;
            result.northLatitude = (courseStatus & 0x0400) === 0;
            
            offset += 2;

            // Adjust coordinates
            if (result.longitude !== undefined && !result.eastLongitude) {
              result.longitude = -result.longitude;
            }
            if (result.latitude !== undefined && !result.northLatitude) {
              result.latitude = -result.latitude;
            }
          }
        }
      }

      // LBS Info for standard protocols
      if (offset + 9 <= data.length) {
        result.mcc = data.readUInt16BE(offset);
        result.mnc = data[offset + 2];
        result.lac = data.readUInt16BE(offset + 3);
        
        const cellId1 = data[offset + 5];
        const cellId2 = data[offset + 6]; 
        const cellId3 = data[offset + 7];
        result.cellId = (cellId1 << 16) | (cellId2 << 8) | cellId3;
        
        offset += 8;
      }
    }

    // Additional data
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
   * Decode status command (0x8A)
   */
  decodeStatusCommand(data, result) {
    if (data.length >= 1) {
      result.commandType = data[0];
      result.commandData = data.slice(1).toString('hex').toUpperCase();
    }
  }

  /**
   * Decode information transmission (0x94)
   */
  decodeInformationTransmission(data, result) {
    if (data.length > 0) {
      // Information transmission typically contains string data
      try {
        result.informationData = data.toString('utf8');
      } catch (error) {
        result.informationData = data.toString('hex').toUpperCase();
      }
    }
  }

  /**
   * Decode extended commands (0x98, 0x99)
   */
  decodeExtendedCommand(data, result) {
    if (data.length > 0) {
      result.commandData = data.toString('hex').toUpperCase();
      // Try to decode as string if it looks like text
      try {
        const textData = data.toString('utf8');
        if (/^[\x20-\x7E]*$/.test(textData)) { // ASCII printable characters
          result.commandText = textData;
        }
      } catch (error) {
        // Keep as hex if not valid text
      }
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

  /**
   * Decode GPS LBS Status (0xA0) - moved to main GPS decoder
   */
  decodeGPSLBSStatus(data, result) {
    // This is similar to standard GPS LBS but may have different format
    this.decodeGPSLBS(data, result);
  }

  /**
   * Decode location reporting (0x70)
   */
  decodeLocationReporting(data, result) {
    // Location reporting is often similar to GPS LBS data
    this.decodeGPSLBS(data, result);
  }
}

module.exports = GT06Decoder; 