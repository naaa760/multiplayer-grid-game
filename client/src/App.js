import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://localhost:3002");

function App() {
  const [grid, setGrid] = useState(Array(10).fill(Array(10).fill("")));
  const [playerCount, setPlayerCount] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    // Socket event listeners
    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("gridUpdate", (updatedGrid) => {
      setGrid(updatedGrid);
    });

    socket.on("playerCount", (count) => {
      setPlayerCount(count);
    });

    socket.on("error", ({ message }) => {
      setError(message);
      setTimeout(() => setError(""), 3000); // Clear error after 3 seconds
    });

    socket.on("historyUpdate", (updatedHistory) => {
      setHistory(updatedHistory);
    });

    return () => {
      socket.off("connect");
      socket.off("gridUpdate");
      socket.off("playerCount");
      socket.off("error");
      socket.off("historyUpdate");
    };
  }, []);

  const handleCellClick = (row, col) => {
    const value = "X"; // You can modify this to alternate between X and O
    socket.emit("updateCell", { row, col, value });
  };

  return (
    <div className="App">
      <h1>Multiplayer Grid Game</h1>
      <div className="status">
        <p>Players Online: {playerCount}</p>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="grid">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="row">
            {row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="cell"
                onClick={() => handleCellClick(rowIndex, colIndex)}
              >
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="history">
        <h2>Move History</h2>
        {history.map((entry, index) => (
          <div key={index} className="history-entry">
            <p>
              Time: {new Date(entry.timestamp).toLocaleTimeString()}
              {entry.updates.map((update, updateIndex) => (
                <span key={updateIndex}>
                  {` - Player ${update.playerId.slice(0, 4)} placed ${
                    update.value
                  } at (${update.row}, ${update.col})`}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
