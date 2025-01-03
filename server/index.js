const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3002",
    methods: ["GET", "POST"],
  },
});

// Initialize state
const grid = Array(10)
  .fill(null)
  .map(() => Array(10).fill(""));
let onlinePlayers = 0;
const playerLastMove = new Map(); // Track player's last move time
const gridHistory = []; // Store historical updates

// Add update to history with timestamp
const addToHistory = (update) => {
  const timestamp = Date.now();

  // Check if we can group with previous update (within 1 second)
  if (gridHistory.length > 0) {
    const lastUpdate = gridHistory[gridHistory.length - 1];
    if (timestamp - lastUpdate.timestamp < 1000) {
      lastUpdate.updates.push(update);
      return;
    }
  }

  // Create new history entry
  gridHistory.push({
    timestamp,
    updates: [update],
  });
};

// Basic Express route
app.get("/", (req, res) => {
  res.send("Multiplayer Grid Game Server Running");
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  onlinePlayers++;
  io.emit("playerCount", onlinePlayers);
  io.emit("gridUpdate", grid);

  // Send initial history
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

    console.log("Updating grid at:", row, col, "with value:", value);
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
});

// Modified server start code
const startServer = (port) => {
  const handleError = (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(`Port ${port} is busy, trying ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error("Server error:", error);
    }
  };

  httpServer.on("error", handleError);

  httpServer.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

const PORT = process.env.PORT || 3002;
startServer(PORT);
