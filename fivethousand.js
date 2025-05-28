// const Gt06 = require('gt06');
// const net = require('net');

// const PORT = 5000;
// const HOST = '84.247.131.246';

// var server = net.createServer((client) => {
//   var gt06 = new Gt06();
//   console.log('client connected');

//   client.on('data', (data) => {
//     console.log(`Real Data: ${data}`)
//     try {
//       gt06.parse(data);
//     }
//     catch (e) {
//       console.log('err', e);
//       return;
//     }

//     if (gt06.expectsResponse) {
//       client.write(gt06.responseMsg);
//     }

//     gt06.msgBuffer.forEach(msg => {
//       console.log(msg);
//     });

//     gt06.clearMsgBuffer();
//   });
// });

// server.listen(PORT, HOST, () => {
//   console.log('started server on IP:port:',HOST, PORT);
// });

const net = require('net');

// Create the TCP server
const server = net.createServer((socket) => {
  // Buffer to store incoming data for this socket
  let buffer = Buffer.alloc(0);

  // Handle incoming data
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    // Process buffer while there’s enough data for at least start bytes and length
    while (buffer.length >= 3) {
      // Check for GT06 packet start bytes
      if (buffer[0] === 0x78 && buffer[1] === 0x78) {
        const length = buffer[2];
        // Total packet length: start (2) + length (1) + data (length) + checksum (2) + end (2)
        const totalLength = length + 7;

        // Check if we have the full packet
        if (buffer.length >= totalLength) {
          const packet = buffer.slice(0, totalLength);
          processPacket(packet, socket);
          buffer = buffer.slice(totalLength); // Remove processed packet from buffer
        } else {
          break; // Wait for more data
        }
      } else {
        // Discard bytes until we find the start sequence
        buffer = buffer.slice(1);
      }
    }
  });

  // Handle socket errors
  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });

  // Handle socket closure
  socket.on('close', () => {
    console.log('Connection closed');
  });
});

// Start the server
server.listen(5000, () => {
  console.log('Server listening on port 5000');
});

/**
 * Process a complete GT06 packet
 * @param {Buffer} packet - The packet to process
 * @param {net.Socket} socket - The socket to send responses
 */
function processPacket(packet, socket) {
  const length = packet[2];
  const protocolNumber = packet[3];

  // Calculate checksum (assumed to be a 16-bit sum from length to serial number)
  const dataToCheck = packet.slice(2, 2 + length + 2); // From length to serialNo
  let sum = 0;
  for (let i = 0; i < dataToCheck.length; i++) {
    sum += dataToCheck[i];
  }
  sum &= 0xFFFF; // Keep lower 16 bits
  const checksum = packet.readUInt16BE(2 + length + 2);

  if (sum === checksum) {
    // Checksum valid, process based on protocol number
    switch (protocolNumber) {
      case 0x01:
        handleLoginPacket(packet, socket);
        break;
      case 0x12:
        handleLocationPacket(packet);
        break;
      default:
        console.log(`Unknown protocol number: 0x${protocolNumber.toString(16)}`);
    }
  } else {
    console.log('Checksum mismatch');
  }
}

/**
 * Handle login packet (protocol 0x01)
 * @param {Buffer} packet - The login packet
 * @param {net.Socket} socket - The socket to send the response
 */
function handleLoginPacket(packet, socket) {
  // Assuming device ID is 8 bytes starting at offset 4
  const deviceId = packet.slice(4, 12).toString('hex');
  console.log('Device logged in:', deviceId);

  // Construct and send response
  const responseData = [0x05, 0x01, 0x00, 0x01]; // length, protocol, serialNo (example)
  let sum = 0;
  for (let byte of responseData) {
    sum += byte;
  }
  sum &= 0xFFFF;
  const response = Buffer.from([
    0x78, 0x78, // Start bytes
    ...responseData,
    (sum >> 8) & 0xFF, // Checksum high byte
    sum & 0xFF,        // Checksum low byte
    0x0D, 0x0A        // End bytes
  ]);
  socket.write(response);
}

/**
 * Handle location packet (protocol 0x12)
 * @param {Buffer} packet - The location packet
 */
function handleLocationPacket(packet) {
  // Example parsing, adjust offsets and scaling per protocol spec
  const dateTime = parseDateTime(packet.slice(4, 10)); // 6 bytes for date and time
  const latitude = packet.readInt32BE(10) / 1000000;   // 4 bytes, degrees * 1M
  const longitude = packet.readInt32BE(14) / 1000000;  // 4 bytes, degrees * 1M
  const speed = packet.readUInt8(18);                  // 1 byte

  console.log('Location data:', {
    dateTime: dateTime.toISOString(),
    latitude,
    longitude,
    speed
  });
}

/**
 * Parse date and time from 6 bytes
 * @param {Buffer} bytes - 6-byte buffer (year, month, day, hour, minute, second)
 * @returns {Date} - Parsed date object
 */
function parseDateTime(bytes) {
  const year = 2000 + bytes[0];
  const month = bytes[1];
  const day = bytes[2];
  const hour = bytes[3];
  const minute = bytes[4];
  const second = bytes[5];
  return new Date(year, month - 1, day, hour, minute, second);
}