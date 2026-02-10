// @ts-nocheck
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Dictionary } = require('./dictionary');
const { Matchmaker } = require('./matchmaker');
const { Game } = require('./game');

const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const nextHandler = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
    const app = express();
    app.use(cors());

    // Initialize Logic
    const dictionary = Dictionary.getInstance();
    const matchmaker = new Matchmaker();
    const games = {}; // roomId -> Game

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: "*", // Allow all in prod or configure specific
            methods: ["GET", "POST"]
        }
    });

    // ... Socket Logic Below ...

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // --- Basic Word Fetch ---
        socket.on('get_word', () => {
            const word = dictionary.getRandomWord();
            socket.emit('word_data', word);
        });

        // --- Matchmaking ---
        socket.on('join_queue', (playerData) => {
            // console.log("Player joining queue:", playerData);
            const match = matchmaker.addPlayer(socket.id, playerData);

            if (match) {
                // Match Found! Create Game
                console.log(`Match found: ${match.id}`);
                const words = dictionary.getRandomWords(110); // user requested 110 words
                const game = new Game(match.id, match.players, words);
                games[match.id] = game;

                const p1Socket = match.players[0].socketId;
                const p2Socket = match.players[1].socketId;

                // Join room
                io.in(p1Socket).socketsJoin(match.id);
                io.in(p2Socket).socketsJoin(match.id);

                // Notify start
                io.to(match.id).emit('match_start', {
                    roomId: match.id,
                    words: words, // Send full list so client can pre-fetch definitions? No, send definitions.
                    startTime: game.startTime + 5000,
                    opponent: (socketId) => {
                        return match.players.find(p => p.socketId !== socketId)?.player;
                    }
                });

                // Send specific opponent info to each player
                io.to(p1Socket).emit('match_init', {
                    opponent: match.players[1].player,
                    startTime: game.startTime + 5000
                });
                io.to(p2Socket).emit('match_init', {
                    opponent: match.players[0].player,
                    startTime: game.startTime + 5000
                });

            } else {
                socket.emit('queue_update', { status: 'searching' });
            }
        });

        socket.on('leave_queue', () => {
            matchmaker.removePlayer(socket.id);
            socket.emit('queue_update', { status: 'idle' });
        });

        // --- Sprint Mode (Single Player) ---
        socket.on('start_sprint', (playerData) => {
            const roomId = `sprint_${socket.id}`;
            const words = dictionary.getRandomWords(110);

            // Mock a single player "match"
            const player = playerData || { username: "Guest", id: "guest" };
            const players = [{ socketId: socket.id, player }];

            const game = new Game(roomId, players, words);
            games[roomId] = game;

            socket.join(roomId);

            socket.emit('match_start', {
                roomId: roomId,
                words: words,
                startTime: game.startTime + 1000, // Start sooner for single player
                opponent: null // No opponent
            });
        });

        // --- Daily Challenge ---
        socket.on('get_daily', () => {
            const date = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
            const words = dictionary.getDailyWords(date, 3);

            socket.emit('daily_puzzle', {
                date,
                words
            });
        });

        // --- Gameplay ---
        socket.on('submit_guess', ({ roomId, guess }) => {
            const game = games[roomId];
            if (!game) return;

            const result = game.processGuess(socket.id, guess);
            if (result && result.correct) {
                // Emit update to room
                io.to(roomId).emit('score_update', {
                    socketId: socket.id,
                    score: result.score,
                    progress: result.nextIndex // optional
                });
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            matchmaker.removePlayer(socket.id);
            // Handle game forfeit if in game? later.
        });
    });

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
