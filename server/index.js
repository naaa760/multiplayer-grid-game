const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: ["http://localhost:3001", "http://localhost:3000"],
    methods: ["GET", "POST"],
  },
});

// Game state
const grid = Array(10)
  .fill(null)
  .map(() => Array(10).fill(""));
let onlinePlayers = 0;
const playerMoves = new Map();
const gridHistory = [];

function addToHistory(move) {
  const now = Date.now();

  if (gridHistory.length > 0) {
    const lastEntry = gridHistory[gridHistory.length - 1];
    if (now - lastEntry.timestamp < 1000) {
      lastEntry.moves.push(move);
      return;
    }
  }

  gridHistory.push({
    timestamp: now,
    moves: [move],
  });
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);
  onlinePlayers++;

  socket.emit("gridState", grid);
  io.emit("playerCount", onlinePlayers);
  socket.emit("gridHistory", gridHistory);

  socket.on("placeCharacter", ({ row, col, character }) => {
    const playerLastMove = playerMoves.get(socket.id) || 0;
    const now = Date.now();

    if (now - playerLastMove < 60000) {
      const remainingTime = Math.ceil((60000 - (now - playerLastMove)) / 1000);
      socket.emit("error", `Wait ${remainingTime} seconds before next move`);
      return;
    }

    grid[row][col] = character;
    playerMoves.set(socket.id, now);

    const move = { row, col, character, playerId: socket.id, timestamp: now };
    addToHistory(move);

    io.emit("gridState", grid);
    io.emit("gridHistory", gridHistory);
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    onlinePlayers--;
    playerMoves.delete(socket.id);
    io.emit("playerCount", onlinePlayers);
  });
});

// Function to start server with port fallback
const startServer = (port) => {
  try {
    http.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      console.log(`Port ${port} is busy, trying ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error("Server error:", error);
    }
  }
};

// Handle server errors
http.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`Port ${PORT} is busy, trying ${PORT + 1}`);
    startServer(PORT + 1);
  } else {
    console.error("Server error:", error);
  }
});

const PORT = process.env.PORT || 5000;
startServer(PORT);
