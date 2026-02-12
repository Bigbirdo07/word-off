// @ts-nocheck
const { Dictionary } = require('./dictionary');
const { Matchmaker } = require('./matchmaker');
const { Game } = require('./game');

// Initialize Logic (Singleton/Stateful for the process)
const dictionary = Dictionary.getInstance();
const matchmaker = new Matchmaker();
const games = {}; // roomId -> Game
const gameTimers = {}; // roomId -> setTimeout handle

function endGame(io, roomId) {
    const game = games[roomId];
    if (!game) return;

    game.endGame();
    const results = game.getResults();

    console.log(`Game ended: ${roomId}`);
    console.log(`  Results:`, JSON.stringify(results.players.map(p => ({
        name: p.username, score: p.score, words: p.wordsCorrect
    }))));
    if (results.isDraw) {
        console.log(`  Result: DRAW`);
    } else {
        const winner = results.players.find(p => p.socketId === results.winner);
        console.log(`  Winner: ${winner?.username}`);
    }

    // Emit results to all players in the room
    io.to(roomId).emit('match_result', results);

    // Cleanup
    delete games[roomId];
    if (gameTimers[roomId]) {
        clearTimeout(gameTimers[roomId]);
        delete gameTimers[roomId];
    }
}

function setupSocket(io) {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // --- Basic Word Fetch ---
        socket.on('get_word', () => {
            const word = dictionary.getRandomWord();
            socket.emit('word_data', word);
        });

        // --- Matchmaking ---
        socket.on('join_queue', (playerData) => {
            const match = matchmaker.addPlayer(socket.id, playerData);

            if (match) {
                // Match Found! Create Game
                console.log(`Match found: ${match.id}`);
                const words = dictionary.getRandomWords(110);
                const game = new Game(match.id, match.players, words, 60);
                games[match.id] = game;

                const p1Socket = match.players[0].socketId;
                const p2Socket = match.players[1].socketId;

                // Join room
                io.in(p1Socket).socketsJoin(match.id);
                io.in(p2Socket).socketsJoin(match.id);

                // Send shared match data to both players (no functions — only serializable data)
                io.to(match.id).emit('match_start', {
                    roomId: match.id,
                    words: words,
                    startTime: Date.now() // Start immediately
                });

                // Send per-player opponent info
                io.to(p1Socket).emit('match_init', {
                    roomId: match.id,
                    opponent: match.players[1].player,
                    startTime: Date.now()
                });
                io.to(p2Socket).emit('match_init', {
                    roomId: match.id,
                    opponent: match.players[0].player,
                    startTime: Date.now()
                });

                // Server-side game timer: end the game after 60s + 2s grace
                gameTimers[match.id] = setTimeout(() => {
                    endGame(io, match.id);
                }, 62000); // 60s game + 2s grace

                console.log(`Game ${match.id} will end in 62 seconds.`);

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

            const game = new Game(roomId, players, words, 60);
            games[roomId] = game;

            socket.join(roomId);

            socket.emit('match_start', {
                roomId: roomId,
                words: words,
                startTime: Date.now() + 1000, // Start sooner for single player
                opponent: null
            });

            // Server-side timer for sprint too
            gameTimers[roomId] = setTimeout(() => {
                endGame(io, roomId);
            }, 62000); // 1s + 60s + 1s grace
        });

        // --- Daily Challenge ---
        socket.on('get_daily', () => {
            const date = new Date().toISOString().split('T')[0];
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
            if (game.isFinished()) return;

            const result = game.processGuess(socket.id, guess);
            if (result && result.correct) {
                // Emit update to room (both players see each other's progress)
                io.to(roomId).emit('score_update', {
                    socketId: socket.id,
                    score: result.score,
                    wordsCorrect: result.wordsCorrect,
                    progress: result.nextIndex
                });
            }
        });

        // --- Player signals their timer ended ---
        socket.on('player_finished', ({ roomId }) => {
            const game = games[roomId];
            if (!game) return;

            const allDone = game.playerFinished(socket.id);
            if (allDone) {
                // All players done, end game immediately
                endGame(io, roomId);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            matchmaker.removePlayer(socket.id);

            // Handle active game forfeit
            for (const roomId in games) {
                const game = games[roomId];
                const isInGame = game.players.some(p => p.socketId === socket.id);
                if (isInGame && !game.isFinished() && game.players.length > 1) {
                    console.log(`Player ${socket.id} disconnected during game ${roomId}. Forfeiting.`);
                    // Set their score to 0 (forfeit penalty)
                    game.scores[socket.id] = 0;
                    endGame(io, roomId);
                    break;
                }
            }
        });
    });
}

module.exports = { setupSocket };
