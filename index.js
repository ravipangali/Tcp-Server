// server.js
const net = require('net');

const server = net.createServer((socket) => {
  console.log('Client connected');

  socket.on('data', (data) => {
    const message = data.toString('hex');
    console.log('Received:', message);

    const response = Buffer.from('Echo: ' + message, 'hex');
    socket.write(response);
  });

  socket.on('end', () => {
    console.log('Client disconnected');
  });

  socket.on('error', (err) => {
    console.error('Socket Error:', err);
  });
});

const PORT = 5000;
const HOST = '84.247.131.246';

server.listen(PORT, HOST, () => {
  console.log(`TCP server listening on ${HOST}:${PORT}`);
});