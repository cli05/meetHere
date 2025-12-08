const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Middleware
// Configure CORS to explicitly allow the frontend origin and support credentials.
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const corsOptions = {
  origin: FRONTEND_URL === '*' ? true : FRONTEND_URL,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions));
// Ensure preflight requests are handled
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// MongoDB Connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/meethere';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Routes
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const participantRoutes = require('./routes/participants');

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/participants', participantRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'meetHere API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 API endpoint: http://localhost:${PORT}/api`);
    console.log('🟢 CORS FRONTEND_URL:', FRONTEND_URL);
  });
});

module.exports = app;
