// @ts-nocheck
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { setupSocket } = require('./socket');

const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
    const app = express();
    app.use(cors());

    // Initialize Logic (moved to socket.ts)

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: "*", // Allow all in prod or configure specific
            methods: ["GET", "POST"]
        }
    });

    // ... Socket Logic Below ...

    // ... Socket Logic Below ...
    setupSocket(io);

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
