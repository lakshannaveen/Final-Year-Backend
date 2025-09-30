const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const jwt = require('jsonwebtoken');
dotenv.config();

const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"]
  },
});

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

mongoose.connect(process.env.MONGO_URI , {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Socket.IO user-room management with JWT cookie authentication
const onlineUsers = new Map(); // userId: socket.id

// Socket.IO middleware for JWT cookie authentication
io.use((socket, next) => {
  // Get token from cookies in handshake
  const cookies = socket.handshake.headers.cookie;
  let token = null;

  if (cookies) {
    const tokenMatch = cookies.match(/jwtToken=([^;]+)/);
    if (tokenMatch) {
      token = tokenMatch[1];
    }
  }

  if (!token) {
    console.log("❌ Socket connection rejected: No JWT token in cookies");
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.userId = decoded.id;
    socket.username = decoded.username;
    console.log("✅ Socket authenticated for user:", decoded.id, decoded.username);
    next();
  } catch (err) {
    console.log("❌ Socket connection rejected: Invalid JWT token");
    return next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log("🔌 New Socket.IO connection:", socket.id, "User:", socket.userId);

  // Join user's room using authenticated userId from JWT
  if (socket.userId) {
    console.log("🚪 User joining room:", socket.userId, "Socket:", socket.id);
    onlineUsers.set(socket.userId, socket.id);
    socket.join(socket.userId);
    console.log("👥 Current online users:", Array.from(onlineUsers.keys()));
  }

  socket.on("sendMessage", ({ recipientId, message }) => {
    console.log("📤 Socket sendMessage event:", { 
      from: socket.userId,
      to: recipientId, 
      messageId: message._id
    });
    
    // Emit to recipient with original sender username
    console.log("🔊 Emitting to recipient room:", recipientId);
    io.to(recipientId).emit("receiveMessage", { 
      ...message, 
      sender: message.sender // Keep original sender username for recipient
    });
    
    // Echo to sender as "me" (already handled by API, but double ensure)
    console.log("🔊 Emitting to sender room:", socket.userId);
    io.to(socket.userId).emit("receiveMessage", { 
      ...message, 
      sender: "me" // Mark as "me" for sender
    });
  });

  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected:", socket.id, "User:", socket.userId);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      console.log("🗑️ Removed user from online users:", socket.userId);
    }
    console.log("👥 Remaining online users:", Array.from(onlineUsers.keys()));
  });
});

// Routes
app.use('/api/auth', require('./routes/userRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/feed', require('./routes/feedRoutes'));
app.use("/api/messages", require("./routes/messageRoutes")(io));
app.use('/api', require('./routes/searchRoutes'));
app.use('/api', require('./routes/aiAssistantRoutes'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));