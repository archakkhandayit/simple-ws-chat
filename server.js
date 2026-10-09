import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path, { join } from "path";
import { fileURLToPath } from "url";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Allow up to 10MB payloads in memory for pasting/uploading images
const io = new Server(httpServer, {
  maxHttpBufferSize: 1e7 // 10 MB
});

// Serve static files
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

// In-memory message history buffer (wiped when server restarts)
const MAX_HISTORY = 25;
const messageHistory = [];

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

io.on("connection", (socket) => {
  console.log("Device connected:", socket.id);

  // Broadcast device count
  io.emit("users-count", io.engine.clientsCount);

  // Send recent in-memory history to the newly connected device
  socket.emit("init-history", messageHistory);

  socket.on("send-message", (data) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let payload;

    if (typeof data === "string") {
      payload = {
        id: socket.id,
        type: "text",
        text: data,
        timestamp
      };
    } else {
      payload = {
        id: socket.id,
        type: data.type || "text",
        text: data.text || null,
        dataUrl: data.dataUrl || null,
        fileName: data.fileName || null,
        timestamp
      };
    }

    messageHistory.push(payload);
    if (messageHistory.length > MAX_HISTORY) {
      messageHistory.shift();
    }

    // Broadcast to all devices
    io.emit("receive-message", payload);
  });

  socket.on("clear-chat", () => {
    messageHistory.length = 0;
    io.emit("chat-cleared");
  });

  socket.on("user-typing", (data) => {
    socket.broadcast.emit("user-typing", {
      id: socket.id,
      isTyping: data.isTyping
    });
  });

  socket.on("disconnect", () => {
    console.log("Device disconnected:", socket.id);
    io.emit("users-count", io.engine.clientsCount);
    socket.broadcast.emit("user-typing", {
      id: socket.id,
      isTyping: false
    });
  });
});

const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, "0.0.0.0", () => {
  const localIp = getLocalIp();
  console.log(`\n🚀 Chat Server running!`);
  console.log(`- Local:   http://localhost:${PORT}`);
  console.log(`- Network: http://${localIp}:${PORT} (use this on other devices on your Wi-Fi)\n`);
});