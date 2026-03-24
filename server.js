// =====================================
// ESTRUTURA FINAL: 2 TELAS (HOME + CHAT)
// =====================================

// ================= SERVER (sem mudanças grandes) =================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let waitingUsers = [];

function matchUsers() {
  while (waitingUsers.length >= 2) {
    const u1 = waitingUsers.shift();
    const u2 = waitingUsers.shift();

    u1.partner = u2;
    u2.partner = u1;

    u1.emit('chatStart', true);
    u2.emit('chatStart', false);
  }
}

io.on('connection', (socket) => {
  socket.on('find', () => {
    if (!waitingUsers.includes(socket)) {
      waitingUsers.push(socket);
      matchUsers();
    }
  });

  socket.on('message', (msg) => {
    if (socket.partner) socket.partner.emit('message', msg);
  });

  socket.on('signal', (data) => {
    if (socket.partner) socket.partner.emit('signal', data);
  });

  socket.on('next', () => {
    if (socket.partner) {
      socket.partner.emit('partnerLeft');
      socket.partner.partner = null;
      waitingUsers.push(socket.partner);
    }

    socket.partner = null;

    if (!waitingUsers.includes(socket)) waitingUsers.push(socket);
    matchUsers();
  });

  socket.on('disconnect', () => {
    if (socket.partner) {
      socket.partner.emit('partnerLeft');
      socket.partner.partner = null;
    }
    waitingUsers = waitingUsers.filter(u => u !== socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Servidor rodando na porta', PORT);
});
