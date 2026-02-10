"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Player } from "../hooks/useAuth";
import { WORDS } from "../data/words"; // Use local words

interface EndlessViewProps {
    onExit: () => void;
    player: Player | null;
    onUpdatePlayer?: () => void;
}

export function EndlessView({ onExit, player, onUpdatePlayer }: EndlessViewProps) {
    // Game State
    const [gameState, setGameState] = useState<"playing" | "finished">("playing");
    interface WordResult {
        word: string;
        definition: string;
        status: "correct" | "skipped" | "missed";
    }

    const [results, setResults] = useState<WordResult[]>([]);
    const [correctCount, setCorrectCount] = useState(0);

    // Word State
    const [shuffledWords, setShuffledWords] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [attempts, setAttempts] = useState(0); // 0 to 3
    const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
    const [input, setInput] = useState("");
    const [message, setMessage] = useState("");

    // Init Logic
    useEffect(() => {
        // Shuffle words on mount and take 15
        const list = [...WORDS].sort(() => 0.5 - Math.random()).slice(0, 15);
        setShuffledWords(list);
    }, []);

    // Reset hint on new word
    useEffect(() => {
        setRevealedIndices(new Set());
    }, [currentIndex]);

    function endGame() {
        setGameState("finished");
        saveResult();
    }

    // Current word helpers
    const currentWordData = shuffledWords[currentIndex];
    const currentWord = currentWordData?.word || "";

    const getHintDisplay = () => {
        if (!currentWord) return "";
        return currentWord.split('').map((char: string, i: number) => {
            if (revealedIndices.has(i) || char === " ") return char;
            return "_";
        }).join(" ");
    };

    const handleManualHint = () => {
        if (gameState !== "playing" || !currentWord) return;

        // Reveal next letter (No cost)
        setRevealedIndices(prev => {
            if (prev.size >= currentWord.length) return prev;

            const next = new Set(prev);
            if (!next.has(0)) {
                next.add(0);
            } else {
                const unrevealed = Array.from({ length: currentWord.length }, (_, i) => i)
                    .filter(i => !next.has(i));
                if (unrevealed.length > 0) {
                    const random = unrevealed[Math.floor(Math.random() * unrevealed.length)];
                    next.add(random);
                }
            }
            return next;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (gameState !== "playing" || !currentWord) return;

        const guess = input.toLowerCase().trim();
        const target = currentWord.toLowerCase();

        if (guess === target) {
            // Correct
            setCorrectCount(prev => prev + 1);
            setResults(prev => [...prev, {
                word: currentWordData.word,
                definition: currentWordData.definition,
                status: "correct"
            }]);
            setMessage("Correct!");

            handleNextWord();

        } else {
            // Incorrect
            setAttempts(prev => {
                const newAttempts = prev + 1;
                if (newAttempts >= 3) {
                    setMessage(`Missed! Word was ${currentWord}`);
                    setResults(prev => [...prev, {
                        word: currentWordData.word,
                        definition: currentWordData.definition,
                        status: "missed"
                    }]);
                    handleNextWord();
                } else {
                    setMessage("Try again!");
                }
                return newAttempts < 3 ? newAttempts : 0;
            });
            setInput("");
        }
    };

    const handleNextWordSkip = () => {
        if (gameState !== "playing" || !currentWord) return;
        setResults(prev => [...prev, {
            word: currentWordData.word,
            definition: currentWordData.definition,
            status: "skipped"
        }]);
        handleNextWord();
    };

    const handleNextWord = () => {
        setAttempts(0);
        setInput("");

        if (currentIndex + 1 >= shuffledWords.length) {
            endGame();
        } else {
            setCurrentIndex(prev => prev + 1);
            setTimeout(() => setMessage(""), 1000);
        }
    };

    async function saveResult() {
        if (!player) return;

        await supabase.from("match_history").insert([{
            player_id: player.id,
            opponent_name: "Endless Mode",
            result: "practice",
            score: correctCount, // Using count as score
            rp_change: 0,
            words_solved: []
        }]);

        // Fetch latest count
        const { data: currentData } = await supabase
            .from("players")
            .select("words_solved")
            .eq("id", player.id)
            .single();

        const currentSolved = currentData?.words_solved || 0;

        await supabase.from("players").update({
            words_solved: currentSolved + correctCount
        }).eq("id", player.id);

        if (onUpdatePlayer) onUpdatePlayer();
    }

    return (
        <section className="main-panel match-layout">
            <header className="hero">
                <div className="brand">
                    <div className="logo">WO</div>
                    <div>
                        <p className="eyebrow">Relaxed Practice</p>
                        <h1>Endless</h1>
                    </div>
                </div>
                <div className="meta">
                    <button className="secondary" onClick={onExit}>
                        Back
                    </button>
                    <div className="pill">
                        <span className="label">Progress</span>
                        <span className="value">{currentIndex + 1} / 15</span>
                    </div>
                </div>
            </header>

            {gameState === "playing" && (
                <>
                    <section className="card">
                        <div className="definition">
                            <p className="label">Word {currentIndex + 1}</p>
                            <p className="definition-text">
                                {currentWordData?.definition || "Loading..."}
                            </p>
                            <p className="hint-text" style={{ marginTop: "12px", letterSpacing: "4px" }}>
                                {getHintDisplay()}
                            </p>
                        </div>
                    </section>

                    <section className="controls">
                        <div className="attempts">
                            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                                <button
                                    type="button"
                                    className="hint-button"
                                    onClick={handleManualHint}
                                >
                                    Hint (Free)
                                </button>
                                <button
                                    type="button"
                                    className="hint-button"
                                    style={{ borderColor: 'var(--accent-deep)', color: 'var(--accent-deep)' }}
                                    onClick={handleNextWordSkip}
                                >
                                    Skip
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="guess-form" autoComplete="off">
                            <input
                                type="text"
                                placeholder="Type your guess..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                autoFocus
                            />
                            <button type="submit">Submit</button>
                        </form>
                        <p className="status-text">{message}</p>
                    </section>
                </>
            )}

            {gameState === "finished" && (
                <div className="card">
                    <h2>Session Complete!</h2>
                    <p className="ranked-subtitle">You solved {correctCount} out of 15 words.</p>

                    <ul style={{ listStyle: "none", padding: 0, margin: "24px 0", display: "grid", gap: "12px" }}>
                        {results.map((res, i) => (
                            <li key={i} style={{
                                padding: "12px",
                                background: res.status === "correct" ? "#dff2d8" : "#f7d9cf",
                                borderRadius: "12px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center"
                            }}>
                                <div>
                                    <span style={{ fontWeight: "bold", fontSize: "18px" }}>{res.word}</span>
                                    <span style={{ display: "block", fontSize: "12px", opacity: 0.8 }}>{res.definition.substring(0, 40)}...</span>
                                </div>
                                <span style={{ fontSize: "20px" }}>
                                    {res.status === "correct" ? "✅" : (res.status === "skipped" ? "⏭️" : "❌")}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <div className="ranked-actions">
                        <button className="primary" onClick={() => window.location.reload()}>Play Again</button>
                        <button className="ghost" onClick={onExit}>Return to Lobby</button>
                    </div>
                </div>
            )}
        </section>
    );
}
