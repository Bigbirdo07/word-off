// @ts-nocheck
const fs = require('fs');
const path = require('path');

class Dictionary {
    constructor() {
        this.words = [];
        this.loadWords();
    }

    static getInstance() {
        if (!Dictionary.instance) {
            Dictionary.instance = new Dictionary();
        }
        return Dictionary.instance;
    }

    loadWords() {
        try {
            // Try to read standardized JSON first
            const jsonPath = path.join(process.cwd(), 'data', 'words.json');

            if (fs.existsSync(jsonPath)) {
                const content = fs.readFileSync(jsonPath, 'utf-8');
                this.words = JSON.parse(content);
                console.log(`Loaded ${this.words.length} words from JSON.`);
                return;
            }

            // Fallback to legacy file which is in "window.WORDS = [...]" format
            const method1Path = path.join(process.cwd(), 'legacy_prototype', 'data', 'words.js');
            // Also try the original location if legacy_prototype isn't found (for resilience)
            const method2Path = path.join(process.cwd(), 'data', 'words.js');

            const filePath = fs.existsSync(method1Path) ? method1Path : method2Path;

            if (!fs.existsSync(filePath)) {
                console.warn("Dictionary file not found at:", filePath);
                this.words = [{ word: "error", definition: "Dictionary file not found." }];
                return;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            // Strip "window.WORDS = " and the trailing semicolon to get pure JSON
            const jsonContent = content.replace(/^window\.WORDS\s*=\s*/, '').replace(/;?\s*$/, '');

            this.words = JSON.parse(jsonContent);
            console.log(`Loaded ${this.words.length} words into dictionary.`);
        } catch (error) {
            console.error("Failed to load dictionary:", error);
            this.words = [{ word: "error", definition: "Failed to parse dictionary." }];
        }
    }

    getRandomWord() {
        if (this.words.length === 0) return { word: "empty", definition: "No words loaded." };
        const index = Math.floor(Math.random() * this.words.length);
        return this.words[index];
    }

    getRandomWords(count = 110) {
        const result = new Set();
        let attempts = 0;
        // Safety: try 2x count to find unique words, or stop
        while (result.size < count && attempts < count * 2) {
            const word = this.getRandomWord();
            if (word.word !== "empty") {
                result.add(word);
            }
            attempts++;
        }
        return Array.from(result);
    }
    // Simple seeded RNG (LCG)
    _seededRandom(seed) {
        const m = 0x80000000;
        const a = 1103515245;
        const c = 12345;
        let state = seed ? seed : Math.floor(Math.random() * (m - 1));

        return () => {
            state = (a * state + c) % m;
            return state / (m - 1);
        };
    }

    getDailyWords(dateString, count = 3) {
        // Create a numeric seed from the date string (e.g. "2023-10-27")
        let seed = 0;
        for (let i = 0; i < dateString.length; i++) {
            seed = ((seed << 5) - seed) + dateString.charCodeAt(i);
            seed |= 0;
        }

        const rng = this._seededRandom(Math.abs(seed));
        const result = new Set();
        let attempts = 0;

        // Use the seeded RNG to pick words
        while (result.size < count && attempts < count * 5) {
            const index = Math.floor(rng() * this.words.length);
            const word = this.words[index];
            if (word && word.word !== "empty") {
                result.add(word);
            }
            attempts++;
        }
        return Array.from(result);
    }
}

module.exports = { Dictionary };
