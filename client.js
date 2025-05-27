// client.js
const net = require('net');

const client = net.createConnection({ port: 5000 }, () => {
  console.log('Connected to server');
  client.write('Hello from client!');
});

client.on('data', (data) => {
  console.log('Received from server:', data.toString());
});

client.on('end', () => {
  console.log('Disconnected from server');
});

client.on('error', (err) => {
  console.error('Client Error:', err);
});
