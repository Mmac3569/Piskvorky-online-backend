const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);
  socket.emit('message', 'Welcome to the server!');

  socket.on('disconnect', () => {
    console.log('user disconnected', socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server online")
});