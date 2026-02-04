const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 8000;
const HOST = "0.0.0.0";

// Konfigurasi CORS yang komprehensif
const corsOptions = {
  origin: [
    'http://localhost:5173', 
    'http://192.168.1.99:5173', 
    'http://192.168.1.99:8000',
    'https://eventqueue-fe.vercel.app',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Tambahkan OPTIONS di sini
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false, // Important
  optionsSuccessStatus: 204
};

// Terapkan CORS middleware sekali saja
app.use(cors(corsOptions));

// Middleware untuk parsing JSON
app.use(express.json());

// Routes
const courtsRoute = require("./routes/courts");
const eventRoute = require("./routes/event");
const { router: sseRouter } = require("./routes/sse");

app.use("/api/courts", courtsRoute);
app.use("/api/event", eventRoute);
app.use('/api/sse', sseRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});