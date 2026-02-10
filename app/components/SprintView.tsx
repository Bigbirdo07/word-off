"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Player } from "../hooks/useAuth";
import { WORDS } from "../data/words"; // Use local words

interface SprintViewProps {
    onExit: () => void;
    player: Player | null;
    onUpdatePlayer?: () => void;
}

export function SprintView({ onExit, player, onUpdatePlayer }: SprintViewProps) {
    // Game State
    interface WordResult {
        word: string;
        definition: string;
        status: "correct" | "skipped" | "missed";
    }

    const [gameState, setGameState] = useState<"playing" | "finished">("playing");
    const [results, setResults] = useState<WordResult[]>([]);
    const [timeLeft, setTimeLeft] = useState(60);
    const [correctCount, setCorrectCount] = useState(0);

    // Word State
    const [shuffledWords, setShuffledWords] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [attempts, setAttempts] = useState(0); // 0 to 3
    const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
    const [input, setInput] = useState("");
    const [message, setMessage] = useState("");

    // Refs
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const hintTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Init Logic
    useEffect(() => {
        // Shuffle words on mount - duplicated to ensure enough words
        const list = [...WORDS, ...WORDS, ...WORDS].sort(() => 0.5 - Math.random());
        setShuffledWords(list);

        // Start Game Timer
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    endGame();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (hintTimerRef.current) clearInterval(hintTimerRef.current);
        };
    }, []);

    // ... (rest of file)

    const checkNextWord = () => {
        if (currentIndex + 1 >= shuffledWords.length) {
            endGame();
        } else {
            setCurrentIndex(prev => prev + 1);
        }
    };


    // Hint Timer Logic (New word or reset)
    useEffect(() => {
        if (gameState !== "playing") return;

        // Reset hint state for new word
        setRevealedIndices(new Set());
        if (hintTimerRef.current) clearInterval(hintTimerRef.current);

        // Start hint revealer (every 7s)
        hintTimerRef.current = setInterval(() => {
            setRevealedIndices(prev => {
                const currentWord = shuffledWords[currentIndex]?.word || "";
                if (prev.size >= currentWord.length) return prev;

                const next = new Set(prev);
                // Auto-reveal rule: First char first, then random
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
        }, 7000);

        return () => {
            if (hintTimerRef.current) clearInterval(hintTimerRef.current);
        };
    }, [currentIndex, shuffledWords, gameState]);

    function endGame() {
        setGameState("finished");
        if (timerRef.current) clearInterval(timerRef.current);
        if (hintTimerRef.current) clearInterval(hintTimerRef.current);
        saveResult();
    }

    // Current word helpers
    const currentWordData = shuffledWords[currentIndex];
    const currentWord = currentWordData?.word || "";

    const getHintDisplay = () => {
        if (!currentWord) return "";
        return currentWord.split('').map((char: string, i: number) => {
            // Show if revealed by timer OR if spaces in word (rare)
            if (revealedIndices.has(i) || char === " ") return char;
            return "_";
        }).join(" ");
    };

    const handleManualHint = () => {
        if (gameState !== "playing" || !currentWord) return;

        // Deduct time
        setTimeLeft(prev => {
            const newTime = prev - 1;
            if (newTime <= 0) {
                endGame();
                return 0;
            }
            return newTime;
        });

        // Reveal next letter
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

    const handleGiveUp = () => {
        if (gameState !== "playing" || !currentWord) return;

        setMessage(`Given up! Word was ${currentWord}`);
        setResults(prev => [...prev, {
            word: currentWordData.word,
            definition: currentWordData.definition,
            status: "skipped"
        }]);
        setAttempts(0);
        setInput("");
        checkNextWord();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (gameState !== "playing" || !currentWord) return;

        const guess = input.toLowerCase().trim();
        const target = currentWord.toLowerCase();

        if (guess === target) {
            // Correct
            setResults(prev => [...prev, {
                word: currentWordData.word,
                definition: currentWordData.definition,
                status: "correct"
            }]);
            setCorrectCount(prev => prev + 1);
            setMessage("Correct!");

            // Next word
            setAttempts(0);
            setInput("");
            checkNextWord();

            // Clean transition
            setTimeout(() => setMessage(""), 1000);

        } else {
            // Incorrect
            setAttempts(prev => {
                const newAttempts = prev + 1;
                if (newAttempts >= 3) {
                    // Failed word
                    setMessage(`Missed! Word was ${currentWord}`);
                    setResults(prev => [...prev, {
                        word: currentWordData.word,
                        definition: currentWordData.definition,
                        status: "missed"
                    }]);
                    setAttempts(0);
                    setInput("");
                    checkNextWord();
                } else {
                    setMessage("Try again!");
                }
                return newAttempts < 3 ? newAttempts : 0;
            });
            setInput(""); // Clear input on wrong guess
        }
    };

    async function saveResult() {
        if (!player) return;

        // Simple save for sprint
        await supabase.from("match_history").insert([{
            player_id: player.id,
            opponent_name: "Sprint Bot",
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

        // Update words solved count
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
                        <p className="eyebrow">Definition Sprint</p>
                        <h1>WordOff</h1>
                    </div>
                </div>
                <div className="meta">
                    <button className="secondary" onClick={onExit}>
                        Back
                    </button>
                    <div className="pill">
                        <span className="label">Time</span>
                        <span className="value">{timeLeft}</span>
                    </div>
                    <div className="pill">
                        <span className="label">Word</span>
                        <span className="value">{correctCount}</span>
                    </div>
                </div>
            </header>

            {gameState === "playing" && (
                <>
                    <section className="card">
                        <div className="definition">
                            <p className="label">Word {correctCount + 1}</p>
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
                            <div className="attempts-row" style={{ marginBottom: "12px", justifyContent: "center", display: "flex" }}>
                                <div className="attempt-dots">
                                    {[0, 1, 2].map(i => (
                                        <div
                                            key={i}
                                            className={`attempt-dot ${i < attempts ? 'is-used' : ''}`}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                                <button
                                    type="button"
                                    className="hint-button"
                                    onClick={handleManualHint}
                                >
                                    Hint (-1s)
                                </button>
                                <button
                                    type="button"
                                    className="hint-button"
                                    style={{ borderColor: 'var(--accent-deep)', color: 'var(--accent-deep)' }}
                                    onClick={handleGiveUp}
                                >
                                    Give Up
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
                    <h2>Time's Up!</h2>
                    <p className="ranked-subtitle">You solved {correctCount} words.</p>

                    <ul style={{ listStyle: "none", padding: 0, margin: "24px 0", display: "grid", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
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
