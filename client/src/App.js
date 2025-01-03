import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import "./App.css";

// Update the socket connection configuration
const SOCKET_PORTS = [5000, 5001, 5002, 5003]; // Possible ports

const connectToServer = () => {
  for (const port of SOCKET_PORTS) {
    try {
      const socket = io(`http://localhost:${port}`, {
        transports: ["websocket"],
        timeout: 1000, // Short timeout for quick fallback
      });

      socket.on("connect", () => {
        console.log(`Connected to server on port ${port}`);
      });

      socket.on("connect_error", (error) => {
        console.log(`Failed to connect on port ${port}:`, error);
      });

      return socket;
    } catch (error) {
      console.log(`Error connecting to port ${port}:`, error);
    }
  }
  throw new Error("Could not connect to any server port");
};

const socket = connectToServer();

function App() {
  const [grid, setGrid] = useState(
    Array(10)
      .fill(null)
      .map(() => Array(10).fill(""))
  );
  const [playerCount, setPlayerCount] = useState(0);
  const [character, setCharacter] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState(null);

  // Add connection status state
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connection status
    socket.on("connect", () => {
      console.log("Connected to server!");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server!");
      setIsConnected(false);
    });

    socket.on("gridState", (newGrid) => {
      console.log("Received grid update:", newGrid);
      setGrid(newGrid);
    });

    socket.on("playerCount", (count) => {
      console.log("Player count updated:", count);
      setPlayerCount(count);
    });

    socket.on("gridHistory", (newHistory) => {
      console.log("Received history update:", newHistory);
      setHistory(newHistory);
    });

    socket.on("error", (message) => {
      console.log("Received error:", message);
      setError(message);
      setTimeout(() => setError(""), 3000);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("gridState");
      socket.off("playerCount");
      socket.off("gridHistory");
      socket.off("error");
    };
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handleCellClick = (row, col) => {
    console.log("Cell clicked:", row, col);
    console.log("Current character:", character);
    console.log("Cooldown:", cooldown);
    console.log("Current cell value:", grid[row][col]);

    if (!character) {
      console.log("No character selected");
      setError("Please enter a character first");
      return;
    }

    if (cooldown > 0) {
      console.log("Still in cooldown");
      return;
    }

    if (grid[row][col]) {
      console.log("Cell already filled");
      return;
    }

    console.log("Emitting placeCharacter event");
    socket.emit("placeCharacter", { row, col, character });
    setCharacter("");
    setCooldown(60);
  };

  const viewHistory = (index) => {
    if (index === null) {
      socket.emit("requestCurrentState");
      setViewingHistoryIndex(null);
      return;
    }

    // Reconstruct grid state up to selected point
    const historicGrid = Array(10)
      .fill(null)
      .map(() => Array(10).fill(""));
    for (let i = 0; i <= index; i++) {
      history[i].moves.forEach((move) => {
        historicGrid[move.row][move.col] = move.character;
      });
    }
    setGrid(historicGrid);
    setViewingHistoryIndex(index);
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Multiplayer Grid Game</h1>
        <div className="status-info">
          <p>
            Connection Status:{" "}
            {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
          </p>
          <p>👥 Players Online: {playerCount}</p>
          {cooldown > 0 && (
            <p className="cooldown">⏳ Next move in: {cooldown}s</p>
          )}
        </div>
        {error && <p className="error">❌ {error}</p>}
      </div>

      <div className="controls">
        <input
          type="text"
          maxLength="1"
          value={character}
          onChange={(e) => setCharacter(e.target.value)}
          placeholder="Enter character"
          disabled={cooldown > 0}
        />
      </div>

      <div className="grid">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="row">
            {row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`cell ${cell ? "filled" : ""}`}
                onClick={() => handleCellClick(rowIndex, colIndex)}
              >
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="history">
        <h3>History</h3>
        <button
          onClick={() => viewHistory(null)}
          className={viewingHistoryIndex === null ? "active" : ""}
        >
          Current
        </button>
        {history.map((entry, index) => (
          <button
            key={entry.timestamp}
            onClick={() => viewHistory(index)}
            className={viewingHistoryIndex === index ? "active" : ""}
          >
            {new Date(entry.timestamp).toLocaleTimeString()}(
            {entry.moves.length} moves)
          </button>
        ))}
      </div>
    </div>
  );
}

export default App;
