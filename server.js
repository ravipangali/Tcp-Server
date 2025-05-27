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
server.listen(PORT, () => {
  console.log(`TCP server listening on port ${PORT}`);
});
