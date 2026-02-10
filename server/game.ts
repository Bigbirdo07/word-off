// @ts-nocheck
class Game {
    constructor(id, players, words) {
        this.id = id;
        this.players = players; // array of { socketId, player }
        this.words = words; // array of WordEntry
        this.startTime = Date.now();
        this.scores = {}; // socketId -> score
        this.progress = {}; // socketId -> wordIndex
        this.finished = {}; // socketId -> boolean

        players.forEach(p => {
            this.scores[p.socketId] = 0;
            this.progress[p.socketId] = 0;
            this.finished[p.socketId] = false;
        });
    }

    processGuess(socketId, guess) {
        const currentIndex = this.progress[socketId];
        if (currentIndex >= this.words.length) return false;

        const targetWord = this.words[currentIndex].word.toLowerCase();

        if (guess.toLowerCase() === targetWord) {
            this.scores[socketId] += 10; // 10 points per word
            this.progress[socketId] += 1;

            // Bonus for speed? (Later)

            return { correct: true, score: this.scores[socketId], nextIndex: this.progress[socketId] };
        }

        return { correct: false };
    }

    getState() {
        return {
            id: this.id,
            scores: this.scores,
            progress: this.progress,
            timeLeft: Math.max(0, 60 - (Date.now() - this.startTime) / 1000)
        };
    }
}

module.exports = { Game };
