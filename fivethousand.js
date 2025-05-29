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
// const Gt06FrameDecoder = require('./gt06FrameDecoder');

class Gt06FrameDecoder {
    decode(buffer) {
        if (buffer.length < 5) {
            return null;
        }

        let length = 2 + 2; // head and tail
        if (buffer.readUInt8(0) === 0x78) {
            length += 1 + buffer.readUInt8(2);
        } else {
            length += 2 + buffer.readUInt16BE(2);
        }

        if (buffer.length >= length && buffer.readUInt16BE(length - 2) === 0x0D0A) {
            return buffer.slice(0, length);
        }

        let endIndex = -1;
        while (true) {
            endIndex = buffer.indexOf(0x0D, endIndex + 1);
            if (endIndex > 0 && endIndex + 1 < buffer.length && buffer.readUInt8(endIndex + 1) === 0x0A) {
                return buffer.slice(0, endIndex + 2);
            }
            if (endIndex === -1) {
                break;
            }
        }

        return null;
    }
}

const PORT = 5000;
const HOST = '84.247.131.246';

const decoder = new Gt06FrameDecoder();

const server = net.createServer((socket) => {
    console.log(`Client connected: ${socket.remoteAddress}:${socket.remotePort}`);

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);

        while (buffer.length >= 5) {
            const frame = decoder.decode(buffer);
            if (frame) {
                console.log('Decoded frame:', frame.toString('hex'));
                buffer = buffer.slice(frame.length);
            } else {
                break; // Wait for more data
            }
        }
    });

    socket.on('end', () => {
        console.log(`Client disconnected: ${socket.remoteAddress}:${socket.remotePort}`);
    });

    socket.on('error', (err) => {
        console.error(`Socket error: ${err.message}`);
    });
});

server.on('error', (err) => {
    console.error(`Server error: ${err.message}`);
});

server.listen(PORT, HOST, () => {
    console.log(`Server listening on ${HOST}:${PORT}`);
});