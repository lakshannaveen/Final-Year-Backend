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

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Make io accessible to routes
app.set('io', io);

// Track online users
const onlineUsers = new Map();

// Socket.IO auth using JWT from cookies
io.use((socket, next) => {
  const cookies = socket.handshake.headers.cookie;
  let token = null;

  if (cookies) {
    const tokenMatch = cookies.match(/jwtToken=([^;]+)/);
    if (tokenMatch) token = tokenMatch[1];
  }

  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.userId = decoded.id;
    socket.username = decoded.username;
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid token"));
  }
});

// Socket.IO events
io.on("connection", (socket) => {
  if (socket.userId) {
    onlineUsers.set(socket.userId, socket.id);
    socket.join(socket.userId);
  }

  socket.on("sendMessage", ({ recipientId, message }) => {
    io.to(recipientId).emit("receiveMessage", {
      ...message,
      sender: message.sender
    });

    io.to(socket.userId).emit("receiveMessage", {
      ...message,
      sender: "me"
    });
  });

  socket.on("disconnect", () => {
    if (socket.userId) onlineUsers.delete(socket.userId);
  });
});

// Routes
app.use('/api/auth', require('./routes/userRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/feed', require('./routes/feedRoutes'));
app.use("/api/messages", require("./routes/messageRoutes")(io));
app.use('/api', require('./routes/searchRoutes'));
app.use('/api', require('./routes/aiAssistantRoutes'));
app.use('/api/reviews', require('./routes/reviewsRoutes'));

// Root route
app.get('/', (req, res) => {
  console.log('✅ Root route accessed');

  res.status(200).json({
    message: 'Server is running successfully!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: process.env.PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Catch-all for unmatched routes (fixed — no "*")
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
