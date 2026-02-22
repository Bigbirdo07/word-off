"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Player } from "../hooks/useAuth";

interface DailyViewProps {
    socket: any;
    onExit: () => void;
    player: Player | null;
    onUpdatePlayer?: () => void;
}

export function DailyView({ socket, onExit, player, onUpdatePlayer }: DailyViewProps) {
    const [words, setWords] = useState<any[]>([]);
    const [date, setDate] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [input, setInput] = useState("");
    const [isComplete, setIsComplete] = useState(false);
    const [message, setMessage] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    interface DailyResult {
        word: string;
        status: "correct" | "missed";
        definition: string;
    }

    const [results, setResults] = useState<DailyResult[]>([]);

    useEffect(() => {
        if (!socket) return;

        const handleDailyPuzzle = (data: any) => {
            console.log("Daily Data:", data);
            setWords(data.words);
            setDate(data.date);
        };

        const handleConnect = () => {
            console.log("Socket reconnected, requesting daily puzzle...");
            socket.emit("get_daily");
        };

        socket.on("daily_puzzle", handleDailyPuzzle);
        socket.on("connect", handleConnect);

        // Request data on mount (buffered if connecting, or sent if already connected)
        socket.emit("get_daily");

        return () => {
            socket.off("daily_puzzle", handleDailyPuzzle);
            socket.off("connect", handleConnect);
        };
    }, [socket]);

    const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());

    const currentWordData = words[currentIndex];
    const currentWord = currentWordData?.word || "";

    // Reset hints when word changes
    useEffect(() => {
        setRevealedIndices(new Set());
    }, [currentIndex]);

    const handleHint = () => {
        if (revealedIndices.size >= 3 || revealedIndices.size >= currentWord.length) return;

        setRevealedIndices(prev => {
            const next = new Set(prev);
            if (!next.has(0)) {
                next.add(0);
            } else {
                // Find all unrevealed indices
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

    const getHintDisplay = () => {
        if (!currentWord) return "_ _ _ _ _";
        return currentWord.split('').map((char: string, i: number) => {
            if (revealedIndices.has(i)) return char;
            return "_";
        }).join(" ");
    };

    const handleGiveUp = () => {
        if (!currentWordData || isProcessing) return;
        setIsProcessing(true);

        setMessage(`The word was: ${currentWordData.word}`);

        setResults(prev => [...prev, {
            word: currentWordData.word,
            status: "missed",
            definition: currentWordData.definition
        }]);

        setTimeout(() => {
            setMessage("");
            setInput("");
            setRevealedIndices(new Set());
            if (currentIndex + 1 >= words.length) {
                setIsComplete(true);
            } else {
                setCurrentIndex(prev => prev + 1);
                setIsProcessing(false);
            }
        }, 2000);
    };

    async function saveDailyProgress(count: number) {
        if (!player) return;

        const { data: currentData } = await supabase
            .from("players")
            .select("words_solved")
            .eq("id", player.id)
            .single();

        const currentSolved = currentData?.words_solved || 0;

        await supabase.from("players").update({
            words_solved: currentSolved + count
        }).eq("id", player.id);

        if (onUpdatePlayer) onUpdatePlayer();
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!words.length || isComplete || isProcessing) return;

        if (input.toLowerCase().trim() === currentWord.toLowerCase()) {
            setMessage("Correct!");

            const newResult: DailyResult = {
                word: currentWordData.word,
                status: "correct",
                definition: currentWordData.definition
            };

            setResults(prev => [...prev, newResult]);
            setInput("");
            setRevealedIndices(new Set()); // Reset hints

            const newCorrectCount = results.filter(r => r.status === "correct").length + 1;

            if (currentIndex + 1 >= words.length) {
                setIsComplete(true);
                saveDailyProgress(newCorrectCount);
            } else {
                setCurrentIndex(prev => prev + 1);
                setTimeout(() => setMessage(""), 1000);
            }
        } else {
            setMessage("Try again!");
            setTimeout(() => setMessage(""), 1000);
        }
    };

    if (words.length === 0) {
        return (
            <div className="card" style={{ textAlign: "center", padding: "40px" }}>
                <h3 style={{ marginBottom: "12px" }}>Loading Daily Challenge...</h3>
                <p style={{ opacity: 0.6, fontSize: "14px" }}>
                    If the server is waking up from sleep, this may take up to 50 seconds. Please wait!
                </p>
            </div>
        );
    }

    const correctCount = results.filter(r => r.status === "correct").length;

    return (
        <section className="main-panel match-layout">
            <header className="hero">
                <div className="brand">
                    <div className="logo">WO</div>
                    <div>
                        <p className="eyebrow">Daily Challenge</p>
                        <h1>{date}</h1>
                    </div>
                </div>
                <div className="meta">
                    <button className="secondary" onClick={onExit}>
                        Back
                    </button>
                    <div className="pill">
                        <span className="label">Progress</span>
                        <span className="value">{currentIndex + (isComplete ? 0 : 1)} / {words.length}</span>
                    </div>
                </div>
            </header>

            {!isComplete && (
                <>
                    <section className="card">
                        <div className="definition">
                            <p className="label">Word {currentIndex + 1}</p>
                            <p className="definition-text">
                                {words[currentIndex]?.definition}
                            </p>
                            <p className="hint-text" style={{ marginTop: "12px", letterSpacing: "4px" }}>
                                {getHintDisplay()}
                            </p>
                        </div>
                    </section>

                    <section className="controls">
                        <div className="attempts">
                            <button
                                type="button"
                                className="hint-button"
                                onClick={handleHint}
                                disabled={revealedIndices.size >= 3 || isProcessing}
                            >
                                Hint ({revealedIndices.size}/3)
                            </button>
                            <button
                                type="button"
                                className="hint-button"
                                style={{ borderColor: 'var(--accent-deep)', color: 'var(--accent-deep)' }}
                                onClick={handleGiveUp}
                                disabled={isProcessing}
                            >
                                Give Up
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="guess-form" autoComplete="off">
                            <input
                                type="text"
                                placeholder="Type your guess..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                autoFocus
                                disabled={isProcessing}
                            />
                            <button type="submit" disabled={isProcessing}>Submit</button>
                        </form>
                    </section>
                    <p className="status-text">{message}</p>
                </>
            )}

            {isComplete && (
                <div className="card">
                    <h2>Daily Summary</h2>
                    <p className="ranked-subtitle">You got {correctCount} out of {words.length} correct.</p>

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
                                    {res.status === "correct" ? "✅" : "❌"}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <button className="primary" onClick={onExit}>Return to Lobby</button>
                </div>
            )}

        </section>
    );
}
