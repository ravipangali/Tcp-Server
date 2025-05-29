const net = require('net');

// CRC16 table and function
const crc16Table = new Uint16Array([
    0x0000, 0x1189, 0x2312, 0x329B, 0x4624, 0x57AD, 0x6536, 0x74BF, 0x8C48,
    0x9DC1, 0xAF5A, 0xBED3, 0xCA6C, 0xDBE5, 0xE97E, 0xF8F7, 0x1081, 0x0108,
    0x3393, 0x221A, 0x56A5, 0x472C, 0x75B7, 0x643E, 0x9CC9, 0x8D40, 0xBFDB,
    0xAE52, 0xDAED, 0xCB64, 0xF9FF, 0xE876, 0x2102, 0x308B, 0x0210, 0x1399,
    0x6726, 0x76AF, 0x4434, 0x55BD, 0xAD4A, 0xBCC3, 0x8E58, 0x9FD1, 0xEB6E,
    0xFAE7, 0xC87C, 0xD9F5, 0x3183, 0x200A, 0x1291, 0x0318, 0x77A7, 0x662E,
    0x54B5, 0x453C, 0xBDCB, 0xAC42, 0x9ED9, 0x8F50, 0xFBEF, 0xEA66, 0xD8FD,
    0xC974, 0x4204, 0x538D, 0x6116, 0x709F, 0x0420, 0x15A9, 0x2732, 0x36BB,
    0xCE4C, 0xDFC5, 0xED5E, 0xFCD7, 0x8868, 0x99E1, 0xAB7A, 0xBAF3, 0x5285,
    0x430C, 0x7197, 0x601E, 0x14A1, 0x0528, 0x37B3, 0x263A, 0xDECD, 0xCF44,
    0xFDDF, 0xEC56, 0x98E9, 0x8960, 0xBBFB, 0xAA72, 0x6306, 0x728F, 0x4014,
    0x519D, 0x2522, 0x34AB, 0x0630, 0x17B9, 0xEF4E, 0xFEC7, 0xCC5C, 0xDDD5,
    0xA96A, 0xB8E3, 0x8A78, 0x9BF1, 0x7387, 0x620E, 0x5095, 0x411C, 0x35A3,
    0x242A, 0x16B1, 0x0738, 0xFFCF, 0xEE46, 0xDCDD, 0xCD54, 0xB9EB, 0xA862,
    0x9AF9, 0x8B70, 0x8408, 0x9581, 0xA71A, 0xB693, 0xC22C, 0xD3A5, 0xE13E,
    0xF0B7, 0x0840, 0x19C9, 0x2B52, 0x3ADB, 0x4E64, 0x5FED, 0x6D76, 0x7CFF,
    0x9489, 0x8500, 0xB79B, 0xA612, 0xD2AD, 0xC324, 0xF1BF, 0xE036, 0x18C1,
    0x0948, 0x3BD3, 0x2A5A, 0x5EE5, 0x4F6C, 0x7DF7, 0x6C7E, 0xA50A, 0xB483,
    0x8618, 0x9791, 0xE32E, 0xF2A7, 0xC03C, 0xD1B5, 0x2942, 0x38CB, 0x0A50,
    0x1BD9, 0x6F66, 0x7EEF, 0x4C74, 0x5DFD, 0xB58B, 0xA402, 0x9699, 0x8710,
    0xF3AF, 0xE226, 0xD0BD, 0xC134, 0x39C3, 0x284A, 0x1AD1, 0x0B58, 0x7FE7,
    0x6E6E, 0x5CF5, 0x4D7C, 0xC60C, 0xD785, 0xE51E, 0xF497, 0x8028, 0x91A1,
    0xA33A, 0xB2B3, 0x4A44, 0x5BCD, 0x6956, 0x78DF, 0x0C60, 0x1DE9, 0x2F72,
    0x3EFB, 0xD68D, 0xC704, 0xF59F, 0xE416, 0x90A9, 0x8120, 0xB3BB, 0xA232,
    0x5AC5, 0x4B4C, 0x79D7, 0x685E, 0x1CE1, 0x0D68, 0x3FF3, 0x2E7A, 0xE70E,
    0xF687, 0xC41C, 0xD595, 0xA12A, 0xB0A3, 0x8238, 0x93B1, 0x6B46, 0x7ACF,
    0x4854, 0x59DD, 0x2D62, 0x3CEB, 0x0E70, 0x1FF9, 0xF78F, 0xE606, 0xD49D,
    0xC514, 0xB1AB, 0xA022, 0x92B9, 0x8330, 0x7BC7, 0x6A4E, 0x58D5, 0x495C,
    0x3DE3, 0x2C6A, 0x1EF1, 0x0F78]);

const crc16Buffer = Buffer.from(crc16Table.buffer);

function getCrc16(input) {
    let fcs = 0xFFFF;
    for (let i = 0; i < input.length; i++) {
        let index = ((fcs ^ input.readUInt8(i)) & 0xFF) * 2;
        fcs = (fcs >> 8) ^ crc16Buffer.readUInt16LE(index);
    }
    let ret = Buffer.alloc(2);
    ret.writeUInt16BE((~fcs) & 0xFFFF);
    return ret;
}

// GT06 Protocol Implementation
function Gt06() {
    this.msgBufferRaw = [];
    this.msgBuffer = [];
    this.imei = null;
}

Gt06.prototype.parse = function(data) {
    this.msgBufferRaw.length = 0;
    const parsed = { expectsResponse: false };

    if (!checkHeader(data)) {
        throw { error: 'unknown message header', msg: data };
    }

    this.msgBufferRaw = sliceMsgsInBuff(data).slice();
    this.msgBufferRaw.forEach((msg, idx) => {
        switch (selectEvent(msg).number) {
            case 0x01: // login message
                Object.assign(parsed, parseLogin(msg));
                parsed.imei = parsed.imei;
                parsed.expectsResponse = true;
                parsed.responseMsg = createResponse(msg);
                break;
            case 0x12: // location message
                Object.assign(parsed, parseLocation(msg), { imei: this.imei });
                break;
            case 0x13: // status message
                Object.assign(parsed, parseStatus(msg), { imei: this.imei });
                parsed.expectsResponse = true;
                parsed.responseMsg = createResponse(msg);
                break;
            case 0x16: // alarm message
                Object.assign(parsed, parseAlarm(msg), { imei: this.imei });
                break;
            default:
                throw { error: 'unknown message type', event: selectEvent(msg) };
        }
        parsed.event = selectEvent(msg);
        parsed.parseTime = Date.now();
        if (idx === this.msgBufferRaw.length - 1) {
            Object.assign(this, parsed);
        }
        this.msgBuffer.push(parsed);
    });
}

Gt06.prototype.clearMsgBuffer = function() {
    this.msgBuffer.length = 0;
}

function checkHeader(data) {
    let header = data.slice(0, 2);
    return header.equals(Buffer.from('7878', 'hex'));
}

function selectEvent(data) {
    let eventStr = 'unknown';
    switch (data[3]) {
        case 0x01: eventStr = 'login'; break;
        case 0x12: eventStr = 'location'; break;
        case 0x13: eventStr = 'status'; break;
        case 0x16: eventStr = 'alarm'; break;
    }
    return { number: data[3], string: eventStr };
}

function parseLogin(data) {
    return {
        imei: parseInt(data.slice(4, 12).toString('hex'), 10),
        serialNumber: data.readUInt16BE(12)
    };
}

function parseStatus(data) {
    let statusInfo = data.slice(4, 9);
    let terminalInfo = statusInfo.slice(0, 1).readUInt8(0);
    let voltageLevel = statusInfo.slice(1, 2).readUInt8(0);
    let gsmSigStrength = statusInfo.slice(2, 3).readUInt8(0);

    let alarm = (terminalInfo & 0x38) >> 3;
    let alarmType = 'normal';
    switch (alarm) {
        case 1: alarmType = 'shock'; break;
        case 2: alarmType = 'power cut'; break;
        case 3: alarmType = 'low battery'; break;
        case 4: alarmType = 'sos'; break;
    }

    let termObj = {
        status: Boolean(terminalInfo & 0x01),
        ignition: Boolean(terminalInfo & 0x02),
        charging: Boolean(terminalInfo & 0x04),
        alarmType: alarmType,
        gpsTracking: Boolean(terminalInfo & 0x40),
        relayState: Boolean(terminalInfo & 0x80)
    };

    let voltageLevelStr = 'no power (shutting down)';
    switch (voltageLevel) {
        case 1: voltageLevelStr = 'extremely low battery'; break;
        case 2: voltageLevelStr = 'very low battery (low battery alarm)'; break;
        case 3: voltageLevelStr = 'low battery (can be used normally)'; break;
        case 4: voltageLevelStr = 'medium'; break;
        case 5: voltageLevelStr = 'high'; break;
        case 6: voltageLevelStr = 'very high'; break;
    }

    let gsmSigStrengthStr = 'no signal';
    switch (gsmSigStrength) {
        case 1: gsmSigStrengthStr = 'extremely weak signal'; break;
        case 2: gsmSigStrengthStr = 'very weak signal'; break;
        case 3: gsmSigStrengthStr = 'good signal'; break;
        case 4: gsmSigStrengthStr = 'strong signal'; break;
    }

    return {
        terminalInfo: termObj,
        voltageLevel: voltageLevelStr,
        gsmSigStrength: gsmSigStrengthStr
    };
}

function parseLocation(data) {
    let datasheet = {
        startBit: data.readUInt16BE(0),
        protocolLength: data.readUInt8(2),
        protocolNumber: data.readUInt8(3),
        fixTime: data.slice(4, 10),
        quantity: data.readUInt8(10),
        lat: data.readUInt32BE(11),
        lon: data.readUInt32BE(15),
        speed: data.readUInt8(19),
        course: data.readUInt16BE(20),
        mcc: data.readUInt16BE(22),
        mnc: data.readUInt8(24),
        lac: data.readUInt16BE(25),
        cellId: parseInt(data.slice(27, 30).toString('hex'), 16),
        serialNr: data.readUInt16BE(30),
        errorCheck: data.readUInt16BE(32)
    };

    return {
        fixTime: parseDatetime(datasheet.fixTime).toISOString(),
        fixTimestamp: parseDatetime(datasheet.fixTime).getTime()/1000,
        satCnt: (datasheet.quantity & 0xF0) >> 4,
        satCntActive: (datasheet.quantity & 0x0F),
        lat: decodeGt06Lat(datasheet.lat, datasheet.course),
        lon: decodeGt06Lon(datasheet.lon, datasheet.course),
        speed: datasheet.speed,
        speedUnit: 'km/h',
        realTimeGps: Boolean(datasheet.course & 0x2000),
        gpsPositioned: Boolean(datasheet.course & 0x1000),
        eastLongitude: !Boolean(datasheet.course & 0x0800),
        northLatitude: Boolean(datasheet.course & 0x0400),
        course: (datasheet.course & 0x3FF),
        mcc: datasheet.mcc,
        mnc: datasheet.mnc,
        lac: datasheet.lac,
        cellId: datasheet.cellId,
        serialNr: datasheet.serialNr,
        errorCheck: datasheet.errorCheck
    };
}

function parseAlarm(data) {
    let datasheet = {
        startBit: data.readUInt16BE(0),
        protocolLength: data.readUInt8(2),
        protocolNumber: data.readUInt8(3),
        fixTime: data.slice(4, 10),
        quantity: data.readUInt8(10),
        lat: data.readUInt32BE(11),
        lon: data.readUInt32BE(15),
        speed: data.readUInt8(19),
        course: data.readUInt16BE(20),
        mcc: data.readUInt16BE(22),
        mnc: data.readUInt8(24),
        lac: data.readUInt16BE(25),
        cellId: parseInt(data.slice(27, 30).toString('hex'), 16),
        terminalInfo: data.readUInt8(31),
        voltageLevel: data.readUInt8(32),
        gpsSignal: data.readUInt8(33),
        alarmLang: data.readUInt16BE(34),
        serialNr: data.readUInt16BE(36),
        errorCheck: data.readUInt16BE(38)
    };

    return {
        fixTime: parseDatetime(datasheet.fixTime).toISOString(),
        fixTimestamp: parseDatetime(datasheet.fixTime).getTime()/1000,
        satCnt: (datasheet.quantity & 0xF0) >> 4,
        satCntActive: (datasheet.quantity & 0x0F),
        lat: decodeGt06Lat(datasheet.lat, datasheet.course),
        lon: decodeGt06Lon(datasheet.lon, datasheet.course),
        speed: datasheet.speed,
        speedUnit: 'km/h',
        realTimeGps: Boolean(datasheet.course & 0x2000),
        gpsPositioned: Boolean(datasheet.course & 0x1000),
        eastLongitude: !Boolean(datasheet.course & 0x0800),
        northLatitude: Boolean(datasheet.course & 0x0400),
        course: (datasheet.course & 0x3FF),
        mcc: datasheet.mcc,
        mnc: datasheet.mnc,
        lac: datasheet.lac,
        cellId: datasheet.cellId,
        terminalInfo: datasheet.terminalInfo,
        voltageLevel: datasheet.voltageLevel,
        gpsSignal: datasheet.gpsSignal,
        alarmLang: datasheet.alarmLang,
        serialNr: datasheet.serialNr,
        errorCheck: datasheet.errorCheck
    };
}

function createResponse(data) {
    let respRaw = Buffer.from('787805FF0001d9dc0d0a', 'hex');
    respRaw[3] = data[3];
    appendCrc16(respRaw);
    return respRaw;
}

function parseDatetime(data) {
    return new Date(
        Date.UTC(
            data[0] + 2000, data[1] - 1, data[2], data[3], data[4], data[5]));
}

function decodeGt06Lat(lat, course) {
    var latitude = lat / 60.0 / 30000.0;
    if (!(course & 0x0400)) {
        latitude = -latitude;
    }
    return Math.round(latitude * 1000000) / 1000000;
}

function decodeGt06Lon(lon, course) {
    var longitude = lon / 60.0 / 30000.0;
    if (course & 0x0800) {
        longitude = -longitude;
    }
    return Math.round(longitude * 1000000) / 1000000;
}

function appendCrc16(data) {
    data.writeUInt16BE(getCrc16(data.slice(2, 6)).readUInt16BE(0), data.length - 4);
}

function sliceMsgsInBuff(data) {
    let startPattern = Buffer.from('7878', 'hex');
    let nextStart = data.indexOf(startPattern, 2);
    let msgArray = [];

    if (nextStart === -1) {
        msgArray.push(Buffer.from(data));
        return msgArray;
    }
    msgArray.push(Buffer.from(data.slice(0, nextStart)));
    let redMsgBuff = Buffer.from(data.slice(nextStart));

    while (nextStart !== -1) {
        nextStart = redMsgBuff.indexOf(startPattern, 2);
        if (nextStart === -1) {
            msgArray.push(Buffer.from(redMsgBuff));
            return msgArray;
        }
        msgArray.push(Buffer.from(redMsgBuff.slice(0, nextStart)));
        redMsgBuff = Buffer.from(redMsgBuff.slice(nextStart));
    }
    return msgArray;
}

// TCP Server Implementation
const server = net.createServer((socket) => {
    console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);
    
    const gt06 = new Gt06();
    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
        console.log(`Received data from ${socket.remoteAddress}: ${data.toString('hex')}`);
        
        // Append new data to buffer
        buffer = Buffer.concat([buffer, data]);

        try {
            gt06.parse(buffer);
            
            // Process each message in the buffer
            gt06.msgBuffer.forEach((msg) => {
                console.log('Parsed message:', JSON.stringify(msg, null, 2));
                
                // Send response if required
                if (msg.expectsResponse && msg.responseMsg) {
                    socket.write(msg.responseMsg);
                    console.log(`Sent response: ${msg.responseMsg.toString('hex')}`);
                }
            });

            // Clear the parser's message buffer after processing
            gt06.clearMsgBuffer();
            buffer = Buffer.alloc(0); // Reset buffer after successful parsing
        } catch (error) {
            console.error(`Error parsing data: ${error.error}`, error.msg?.toString('hex'));
            // Keep buffer if parsing fails, might be incomplete message
        }
    });

    socket.on('end', () => {
        console.log(`Client disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
    });

    socket.on('error', (err) => {
        console.error(`Socket error: ${err.message}`);
    });
});

const PORT = 3000;
const HOST = '84.247.131.246';
server.listen(PORT, HOST, () => {
    console.log(`TCP server listening on port ${PORT}`);
});

server.on('error', (err) => {
    console.error(`Server error: ${err.message}`);
});