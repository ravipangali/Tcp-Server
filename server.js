// server.js
const net = require('net');

const server = net.createServer((socket) => {
  console.log('Client connected');

  // Optional: set encoding to automatically handle UTF-8 strings
  // socket.setEncoding('utf8');

  socket.on('data', (data) => {
    // Ensure data is a Buffer, then decode as UTF-8
    const message = data.toString('utf8');
    console.log('Received:', message);

    // Prepare response and encode as Buffer (UTF-8)
    const response = Buffer.from('Echo: ' + message, 'utf8');
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
