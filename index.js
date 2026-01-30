const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET","POST"]
  }
});

// simple in-memory room state
const rooms = {}; // rooms[roomId] = { trackId, playing, position, updatedAt }

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("join", (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { trackId: null, playing: false, position: 0, updatedAt: Date.now() };
    }
    // send current state to the new client
    socket.emit("state", rooms[roomId]);
  });

  socket.on("play", ({ roomId, trackId, position }) => {
    const now = Date.now();
    rooms[roomId] = { trackId, playing: true, position: position ?? 0, updatedAt: now };
    io.to(roomId).emit("play", { trackId, position: rooms[roomId].position, serverTs: now });
  });

  socket.on("pause", ({ roomId, position }) => {
    const now = Date.now();
    if (!rooms[roomId]) rooms[roomId] = {};
    rooms[roomId].playing = false;
    rooms[roomId].position = position ?? rooms[roomId].position;
    rooms[roomId].updatedAt = now;
    io.to(roomId).emit("pause", { position: rooms[roomId].position, serverTs: now });
  });

  socket.on("seek", ({ roomId, position }) => {
    const now = Date.now();
    if (!rooms[roomId]) rooms[roomId] = {};
    rooms[roomId].position = position;
    rooms[roomId].updatedAt = now;
    io.to(roomId).emit("seek", { position, serverTs: now });
  });

  socket.on("requestState", (roomId) => {
    socket.emit("state", rooms[roomId] ?? { trackId: null, playing: false, position: 0, updatedAt: Date.now() });
  });


  socket.on("chat", ({ roomId, user, message }) => {
    console.log("chat", roomId, user, message);
    io.to(roomId).emit("chat", { user, message, serverTs: Date.now() });
  });
  
  socket.on("typing", ({ roomId, user, isTyping }) => {
    // broadcast typing state to room
    io.to(roomId).emit("typing", { user, isTyping });
  });
  
  

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Heartbeat server listening on ${PORT}`);
  }).on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} already in use`);
      process.exit(1);
    }
  });
  
