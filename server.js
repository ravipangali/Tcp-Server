// server.js
const net = require('net');

const server = net.createServer((socket) => {
  console.log('Client connected');

  socket.on('data', (data) => {
    console.log('Received:', data.toString());
    socket.write('Echo: ' + data); // Echo message back
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
  console.log(`TCP server listening on port ${PORT}`);
});
