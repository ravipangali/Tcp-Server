const net = require('net');

const PORT = 6000;
const HOST = '84.247.131.246';

var server = net.createServer(onClientConnection);

function onClientConnection(sock) {
  console.log(`${sock.remoteAddress}:${sock.remotePort} Connected`);
};

server.listen(PORT, HOST, () => {
  console.log('started server on IP:port:', HOST, PORT);

   new Device(sock)
});

class Device {
    constructor(sock) {
        this.imei = null;
        this.sock = sock;
        this.ackSent = false;
        this.ackResp = false;
        this.awaitingResponse = false;
        this.executionIndex = 0;
        this.command = null;
        this.home = null;
        this.failedCRCRetry = 0

        this.onDataReceived = onDataReceived.bind(this);
        this.onImeiReceived = onImeiReceived.bind(this);
        this.onPacketReceived = onPacketReceived.bind(this);
        this.onRecord = onRecord.bind(this);
        this.execute = execute.bind(this);
        this.execTcpCommand = execTcpCommand.bind(this);
        this.onClose = onClose.bind(this);
        this.reset = reset.bind(this);
        this.onError = onError.bind(this);
        this.onRedisMessage = onRedisMessage.bind(this);
        this.responseStorage = {};

        sock.on('data', this.onDataReceived)
        sock.on('close', this.onClose);
        sock.on('error', this.onError);
    }
}