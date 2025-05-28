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

let buffer = Buffer.alloc(0);

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    while (buffer.length >= 3) {
      if (buffer[0] === 0x78 && buffer[1] === 0x78) {
        const length = buffer.readUInt8(2);
        const totalLength = length + 5;

        if (buffer.length >= totalLength) {
          const packet = buffer.slice(0, totalLength);
          processPacket(packet, socket);
          buffer = buffer.slice(totalLength);
        } else {
          break;
        }
      } else {
        buffer = buffer.slice(1);
      }
    }
  });
});

function processPacket(packet, socket) {
  const protocolNumber = packet.readUInt8(3);
  switch (protocolNumber) {
    case 0x01:
      const deviceId = packet.slice(4, 12).toString('hex');
      console.log('Login - Device ID:', deviceId);
      socket.write(Buffer.from([0x78, 0x78, 0x05, 0x01, 0x00, 0x01, 0xCS, 0xCS, 0x0D, 0x0A]));
      break;
    case 0x12:
      const dateTime = parseDateTime(packet.slice(4, 10));
      const latitude = packet.readInt32BE(12) / 1000000;
      const longitude = packet.readInt32BE(16) / 1000000;
      const speed = packet.readUInt8(20);
      console.log('Location:', { dateTime, latitude, longitude, speed });
      break;
  }
}

function parseDateTime(bytes) {
  const year = 2000 + bytes[0];
  const month = bytes[1];
  const day = bytes[2];
  const hour = bytes[3];
  const minute = bytes[4];
  const second = bytes[5];
  return new Date(year, month - 1, day, hour, minute, second);
}

server.listen(5000, () => {
  console.log('Server listening on port 5000');
});