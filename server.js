import express from "express"
import {createServer } from "http";
import { Server } from "socket.io";
import path, { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files
// app.use(express.static(__dirname));
app.get("/", (req, res)=>{
    res.sendFile(join(__dirname, "index.html"))
})

io.on("connection", (socket) => {
  console.log("new socket connected")
  console.log("id: " + socket.id)
  console.log(socket.handshake)

  socket.on("send-message", (message) => {
    console.log("message received: " + message);
    // Broadcast message to all connected clients
    io.emit("receive-message", {
      id: socket.id,
      text: message,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on("user-typing", (data) => {
    // Broadcast typing status to all OTHER clients
    socket.broadcast.emit("user-typing", {
      id: socket.id,
      isTyping: data.isTyping
    });
  });

  socket.on("disconnect", ()=>{
    console.log("socket disconnected. id: " + socket.id);
  })
});

await httpServer.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});