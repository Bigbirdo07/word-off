// @ts-nocheck
class Game {
    constructor(id, players, words, duration = 60, isPrivate = false) {
        this.id = id;
        this.players = players; // array of { socketId, player }
        this.words = words; // array of WordEntry
        this.duration = duration; // seconds
        this.isPrivate = isPrivate; // private lobbies give 0 RP
        this.startTime = Date.now();
        this.endTime = this.startTime + (duration * 1000);
        this.scores = {}; // socketId -> score
        this.progress = {}; // socketId -> wordIndex
        this.finished = {}; // socketId -> boolean
        this.gameOver = false;

        players.forEach(p => {
            this.scores[p.socketId] = 0;
            this.progress[p.socketId] = 0;
            this.finished[p.socketId] = false;
        });
    }

    isFinished() {
        return this.gameOver || Date.now() >= this.endTime;
    }

    processGuess(socketId, guess) {
        if (this.isFinished()) return { correct: false, gameOver: true };

        const currentIndex = this.progress[socketId];
        if (currentIndex >= this.words.length) return { correct: false };

        const targetWord = this.words[currentIndex].word.toLowerCase();

        if (guess.toLowerCase() === targetWord) {
            this.scores[socketId] += 10; // 10 points per word
            this.progress[socketId] += 1;

            return {
                correct: true,
                score: this.scores[socketId],
                nextIndex: this.progress[socketId],
                wordsCorrect: this.progress[socketId]
            };
        }

        return { correct: false };
    }

    // Mark a specific player as done (e.g. time ran out on their client)
    playerFinished(socketId) {
        this.finished[socketId] = true;
        // Check if all players are done
        const allDone = this.players.every(p => this.finished[p.socketId]);
        if (allDone) {
            this.gameOver = true;
        }
        return allDone;
    }

    concede(socketId) {
        // Set their score to -1 so the sorting logic explicitly places them at the bottom
        // and they definitely register as losing against anyone with 0+ points.
        this.scores[socketId] = -1;
        this.gameOver = true;
    }

    endGame() {
        this.gameOver = true;
    }

    getResults() {
        const playerResults = this.players.map(p => ({
            socketId: p.socketId,
            username: p.player.username,
            playerId: p.player.id,
            score: this.scores[p.socketId],
            wordsCorrect: this.progress[p.socketId]
        }));

        // Sort by score descending
        playerResults.sort((a, b) => b.score - a.score);

        // Determine winner (only for 2-player games)
        let winner = null;
        let isDraw = false;

        if (playerResults.length >= 2) {
            if (playerResults[0].score > playerResults[1].score) {
                winner = playerResults[0].socketId;
            } else if (playerResults[0].score === playerResults[1].score) {
                isDraw = true;
            }
        }

        // Calculate RP changes
        const rpChanges = {};
        playerResults.forEach(p => {
            if (this.players.length === 1 || this.isPrivate) {
                // Single player (sprint) or private lobby — no RP
                rpChanges[p.socketId] = 0;
            } else if (isDraw) {
                rpChanges[p.socketId] = 5;
            } else if (p.socketId === winner) {
                rpChanges[p.socketId] = Math.floor(Math.random() * 6) + 18; // 18-23 RP
            } else {
                rpChanges[p.socketId] = -(Math.floor(Math.random() * 6) + 18); // -18 to -23 RP
            }
        });

        return {
            gameId: this.id,
            players: playerResults,
            winner: winner,
            isDraw: isDraw,
            rpChanges: rpChanges,
            duration: this.duration
        };
    }

    getState() {
        return {
            id: this.id,
            scores: this.scores,
            progress: this.progress,
            timeLeft: Math.max(0, (this.endTime - Date.now()) / 1000)
        };
    }
}

module.exports = { Game };
