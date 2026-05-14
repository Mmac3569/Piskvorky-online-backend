const { on } = require('cluster');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const online_players = new Map(); // socket.id -> username mapping
const pending_invs = new Map(); // opponent's username -> username mapping
const random_queue = []; // Queue for players waiting for a random opponent

function getSocketIdByUsername(username) {
  for (const [socketId, name] of online_players.entries()) {
    if (name === username) {
      return socketId;
    }
  }
  return null;
}

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  socket.on('login', (data) => {
    console.log('login event received', data.username);
    if (Array.from(online_players.values()).includes(data.username)) {
      socket.emit('error', { type: 'duplicate_username' });
      console.log('error duplicate_username');
      return;
    }
    online_players.set(socket.id, data.username); // Store the username associated with the socket ID
    //socket.emit('challenge', { from: data.username }); // For testing purposes, we can emit a challenge event to the user themselves
    if (pending_invs.has(data.username)) {
      socket.emit('challenge', { from: pending_invs.get(data.username) });
    }
  });

  socket.on('play', (data) => {
    console.log('play event received', data);
    let name = online_players.get(socket.id);
    if (data.opponent == '<random>') {
      if (random_queue.length > 0) {
        const randomOpponentsRoom = "room" + random_queue.shift();
        socket.join(randomOpponentsRoom)
        io.to(randomOpponentsRoom).emit('start', { room: randomOpponentsRoom });
      } else {
        random_queue.push(name);
        socket.join("room" + name);
      }
    } else {
      if (online_players.has(data.opponent)) {
        console.log('opponent is online, sending challenge');
        console.log(getSocketIdByUsername(data.opponent));
        console.log(io.sockets.sockets.get(getSocketIdByUsername(data.opponent)));
        io.sockets.sockets.get(getSocketIdByUsername(data.opponent)).emit('challenge', { from: name });
      } else {
        console.log('opponent is not online');
        pending_invs.set(data.opponent, name);
      }
    }
  });

  socket.on('accept', (data) => {
    pending_invs.delete(data.from)
    const room = "room" + data.from
    socket.join(room)
    io.to(room).emit('start', { room: room });
  });

  socket.on('reject', (data) => {
    pending_invs.delete(data.from)
    io.to("room" + data.from).emit('rejected');
    io.sockets.adapter.rooms.delete("room" + data.from); // Remove the room from the adapter's rooms map
  });

  socket.on('move', (data) => {
    console.log('move event received', data);
    io.to(data.room).emit('move', data)
  });

  socket.on('rematch', (data) => {
    // Will not be implemented for now
    console.log('rematch event received', data);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected', socket.id);
    // Remove the player from the map when they disconnect
    socket.rooms.forEach((room) => {
      io.to(room).emit('opponent_disconnected');
      io.sockets.adapter.rooms.delete(room) // Remove the room from the adapter's rooms map   
    });
    let name = online_players.get(socket.id)
    online_players.delete(socket.id)
    for (const [oponent, this_player] of pending_invs.entries()) {
      if (this_player == name) {
        pending_invs.delete(oponent)
        break
      }
    }
    random_queue.splice(random_queue.indexOf(name), 1)
  });
});

server.listen(3000, () => {
  console.log("Server online")
});