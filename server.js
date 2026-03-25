const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.use(express.json());

// 🔥 MongoDB Atlas (coloque sua URL no Render)
mongoose.connect(process.env.MONGO_URI);

// MODELO
const User = mongoose.model('User', {
  email: String,
  senha: String,
  creditos: { type: Number, default: 0 }
});

// ===== LOGIN =====
app.post('/register', async (req, res) => {
  const user = await User.create(req.body);
  res.json(user);
});

app.post('/login', async (req, res) => {
  const user = await User.findOne(req.body);
  if (!user) return res.status(401).send('Erro');
  res.json(user);
});

// ===== DEPÓSITO (PIX manual) =====
app.post('/deposito', async (req, res) => {
  const { userId, valor } = req.body;

  await User.findByIdAndUpdate(userId, {
    $inc: { creditos: valor }
  });

  res.send('ok');
});

// ===== SAQUE =====
app.post('/saque', async (req, res) => {
  const { userId, creditos } = req.body;

  const user = await User.findById(userId);

  if (user.creditos < creditos)
    return res.send('Saldo insuficiente');

  user.creditos -= creditos;
  await user.save();

  res.send('Saque solicitado');
});

// ===== CHAT =====
let waiting = [];

function match() {
  while (waiting.length >= 2) {
    const a = waiting.shift();
    const b = waiting.shift();

    a.partner = b;
    b.partner = a;

    a.emit('chatStart', true);
    b.emit('chatStart', false);
  }
}

io.on('connection', (socket) => {

  socket.on('auth', async (userId) => {
    socket.user = await User.findById(userId);
    socket.emit('saldo', socket.user.creditos);
  });

  socket.on('find', () => {
    if (!waiting.includes(socket)) {
      waiting.push(socket);
      match();
    }
  });

  socket.on('signal', (data) => {
    if (socket.partner) {
      socket.partner.emit('signal', data);
    }
  });

  socket.on('emoji', async (valor) => {
    if (!socket.user || !socket.partner) return;

    if (socket.user.creditos >= valor) {

      socket.user.creditos -= valor;
      await socket.user.save();

      socket.partner.user.creditos += valor;
      await socket.partner.user.save();

      socket.emit('saldo', socket.user.creditos);
      socket.partner.emit('saldo', socket.partner.user.creditos);

      socket.partner.emit('message', `Recebeu ${valor} créditos`);
    }
  });
  
  socket.on('next', () => {
    if (socket.partner) {
      socket.partner.emit('partnerLeft');
      socket.partner.partner = null;
      waiting.push(socket.partner);
    }

    socket.partner = null;

    if (!waiting.includes(socket)) waiting.push(socket);
    match();
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Rodando...'));