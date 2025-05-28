const Gt06 = require('gt06');
const net = require('net');

const PORT = 5000;
const HOST = '84.247.131.246';

var server = net.createServer((client) => {
  var gt06 = new Gt06();
  console.log('client connected');

  client.on('data', (data) => {
    try {
      gt06.parse(data);
    }
    catch (e) {
      console.log('err', e);
      return;
    }

    if (gt06.expectsResponse) {
      client.write(gt06.responseMsg);
    }

    gt06.msgBuffer.forEach(msg => {
      console.log(msg);
      console.log(msg.responseMsg);
      if (msg.responseMsg) {
        console.log(msg.responseMsg.toString());
      }
    });

    gt06.clearMsgBuffer();
  });
});

server.listen(PORT, HOST, () => {
  console.log('started server on IP:port:',HOST, PORT);
});