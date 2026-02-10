// @ts-nocheck
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { setupSocket } = require('./socket');

const app = express();
app.use(cors());

// Basic health check
app.get('/', (req, res) => {
    res.send('WordOff Socket Server is Running');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from Vercel
        methods: ["GET", "POST"]
    }
});

// Attach socket logic
setupSocket(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Standalone Socket Server running on port ${PORT}`);
});
