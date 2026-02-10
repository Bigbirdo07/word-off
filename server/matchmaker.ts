// @ts-nocheck
const { v4: uuidv4 } = require('uuid');

class Matchmaker {
    constructor() {
        this.queue = []; // Array of { socketId, player }
    }

    addPlayer(socketId, player) {
        // Remove if already in queue
        this.removePlayer(socketId);

        console.log(`Adding ${player.username} to queue.`);
        this.queue.push({
            socketId,
            player,
            joinedAt: Date.now()
        });

        return this.findMatch();
    }

    removePlayer(socketId) {
        const index = this.queue.findIndex(p => p.socketId === socketId);
        if (index !== -1) {
            console.log(`Removing ${this.queue[index].player.username} from queue.`);
            this.queue.splice(index, 1);
        }
    }

    findMatch() {
        if (this.queue.length < 2) return null;

        // Simple FIFO matching for now. 
        // In future: sort by rank_points diff
        const p1 = this.queue.shift();
        const p2 = this.queue.shift();

        const roomId = uuidv4();

        return {
            id: roomId,
            players: [p1, p2],
            startTime: Date.now() + 5000 // 5 seconds buffer to start
        };
    }
}

module.exports = { Matchmaker };
