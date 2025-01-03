const express = require("express");
const { Server } = require("socket.io");

const app = express();

// Only create server if we're not in Vercel's serverless environment
let io;
if (process.env.NODE_ENV !== "production") {
  const { createServer } = require("http");
  const httpServer = createServer(app);
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000"],
      methods: ["GET", "POST"],
    },
  });

  // Socket.IO connection handling
  io.on("connection", handleSocketConnection);

  // Start server locally
  const PORT = process.env.PORT || 3002;
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} else {
  // For Vercel environment
  io = new Server({
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", handleSocketConnection);
}

// Initialize state
const grid = Array(10)
  .fill(null)
  .map(() => Array(10).fill(""));
let onlinePlayers = 0;
const playerLastMove = new Map();
const gridHistory = [];

function handleSocketConnection(socket) {
  console.log("New client connected:", socket.id);
  onlinePlayers++;
  io.emit("playerCount", onlinePlayers);
  io.emit("gridUpdate", grid);

  socket.emit("historyUpdate", gridHistory);

  socket.on("updateCell", ({ row, col, value }) => {
    console.log("Received updateCell:", { row, col, value });

    const now = Date.now();
    const lastMoveTime = playerLastMove.get(socket.id) || 0;
    const timeElapsed = now - lastMoveTime;

    if (timeElapsed < 60000) {
      console.log("Move rejected - time restriction");
      socket.emit("error", {
        message: `Please wait ${Math.ceil(
          (60000 - timeElapsed) / 1000
        )} seconds`,
      });
      return;
    }

    grid[row][col] = value;
    playerLastMove.set(socket.id, now);
    addToHistory({ row, col, value, playerId: socket.id });

    io.emit("gridUpdate", grid);
    io.emit("historyUpdate", gridHistory);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    onlinePlayers--;
    playerLastMove.delete(socket.id);
    io.emit("playerCount", onlinePlayers);
  });
}

function addToHistory(update) {
  const timestamp = Date.now();
  if (gridHistory.length > 0) {
    const lastUpdate = gridHistory[gridHistory.length - 1];
    if (timestamp - lastUpdate.timestamp < 1000) {
      lastUpdate.updates.push(update);
      return;
    }
  }
  gridHistory.push({
    timestamp,
    updates: [update],
  });
}

// Basic Express route
app.get("/api", (req, res) => {
  res.json({ message: "Multiplayer Grid Game Server Running" });
});

// For Vercel serverless functions
module.exports = app;
