"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getRankFromRP } from "@/lib/ranks";
import { Player } from "../hooks/useAuth";

interface MatchViewProps {
    socket: any;
    matchData: any;
    onExit: () => void;
    player: Player | null;
    onUpdatePlayer?: () => void;
}

interface MatchResult {
    gameId: string;
    players: { socketId: string; username: string; playerId: string; score: number; wordsCorrect: number }[];
    winner: string | null;
    isDraw: boolean;
    rpChanges: Record<string, number>;
    duration: number;
}

export function MatchView({ socket, matchData, onExit, player, onUpdatePlayer }: MatchViewProps) {
    // Game state
    const [words, setWords] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [input, setInput] = useState("");
    const [score, setScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [gameState, setGameState] = useState<"playing" | "finished">("playing");
    const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
    const [opponentName, setOpponentName] = useState("Opponent");
    const [roomId, setRoomId] = useState<string | null>(null);
    const [message, setMessage] = useState("");

    // Hint state (like Sprint)
    const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
    const [hintsUsed, setHintsUsed] = useState(0);
    const MAX_HINTS = 3;

    // Refs
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const gameStartedRef = useRef(false);
    const resultSavedRef = useRef(false);
    const roomIdRef = useRef<string | null>(null);

    // Keep roomId ref in sync for timer closure
    useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

    // ── Initialize from matchData (handles race condition) ──
    useEffect(() => {
        if (matchData?.words) setWords(matchData.words);
        if (matchData?.opponent) setOpponentName(matchData.opponent.username || "Opponent");
        if (matchData?.roomId) setRoomId(matchData.roomId);
        if (matchData?.words?.length > 0 && !gameStartedRef.current) {
            gameStartedRef.current = true;
            startGame();
        }
    }, [matchData]);

    // ── Socket events ──
    useEffect(() => {
        if (!socket) {
            startGame();
            return;
        }

        socket.on("match_start", (data: any) => {
            setWords(data.words);
            setRoomId(data.roomId);
            if (!gameStartedRef.current) {
                gameStartedRef.current = true;
                startGame();
            }
        });

        socket.on("match_init", (data: any) => {
            if (data.opponent) setOpponentName(data.opponent.username || "Opponent");
            if (data.roomId) setRoomId(data.roomId);
        });

        socket.on("score_update", (data: any) => {
            if (data.socketId === socket.id) {
                setScore(data.score);
                setCurrentIndex(data.wordsCorrect || data.progress || 0);
                setInput("");
                setMessage("Correct! ✓");
                setTimeout(() => setMessage(""), 1000);
                // Reset hints for new word
                setRevealedIndices(new Set());
                setHintsUsed(0);
            } else {
                setOpponentScore(data.score);
            }
        });

        // ── MATCH RESULT: Save RP directly here ──
        socket.on("match_result", async (data: MatchResult) => {
            console.log("Match Result from server:", data);
            setMatchResult(data);
            setGameState("finished");
            if (timerRef.current) clearInterval(timerRef.current);
            if (hintTimerRef.current) clearInterval(hintTimerRef.current);

            // Save RP immediately with fresh data from the event
            if (player && !resultSavedRef.current) {
                resultSavedRef.current = true;
                await saveRP(data, socket.id);
            }
        });

        return () => {
            socket.off("match_start");
            socket.off("match_init");
            socket.off("score_update");
            socket.off("match_result");
            if (timerRef.current) clearInterval(timerRef.current);
            if (hintTimerRef.current) clearInterval(hintTimerRef.current);
        };
    }, [socket, player]);

    // ── Save RP (fresh, simple, direct) ──
    async function saveRP(result: MatchResult, mySocketId: string) {
        if (!player) return;

        const rpChange = result.rpChanges[mySocketId] || 0;
        const newRp = Math.max(0, (player.rank_points || 0) + rpChange);
        const rankInfo = getRankFromRP(newRp);

        let outcome = "draw";
        if (result.isDraw) {
            outcome = "draw";
        } else if (result.winner === mySocketId) {
            outcome = "win";
        } else {
            outcome = "loss";
        }

        const myResult = result.players.find(p => p.socketId === mySocketId);
        const finalScore = myResult?.score || 0;

        console.log(`Saving RP: ${outcome} | rpChange: ${rpChange} | newRP: ${newRp} | tier: ${rankInfo.tier}`);

        try {
            // 1. Save match history
            const { error: historyError } = await supabase.from("match_history").insert([{
                player_id: player.id,
                opponent_name: opponentName || "Unknown",
                result: outcome,
                score: finalScore,
                rp_change: rpChange,
                words_solved: []
            }]);
            if (historyError) console.error("Match history save failed:", historyError);

            // 2. Update player rank_points and rank_tier
            const { error: updateError } = await supabase.from("players").update({
                rank_points: newRp,
                rank_tier: rankInfo.tier
            }).eq("id", player.id);

            if (updateError) {
                console.error("Player RP update failed:", updateError);
            } else {
                console.log("✅ RP saved successfully! New RP:", newRp, "Tier:", rankInfo.tier);
            }

            // 3. Refresh player in sidebar
            if (onUpdatePlayer) onUpdatePlayer();
        } catch (err) {
            console.error("Save failed:", err);
        }
    }

    // ── Game start ──
    function startGame() {
        setGameState("playing");
        startTimer();
        setTimeout(() => inputRef.current?.focus(), 100);
    }

    function startTimer() {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(60);

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    if (socket && roomIdRef.current) {
                        socket.emit("player_finished", { roomId: roomIdRef.current });
                    }
                    if (!socket) setGameState("finished");
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    // ── Auto-hint timer (reveal a letter every 7s) ──
    useEffect(() => {
        if (gameState !== "playing" || words.length === 0) return;

        // Reset hints for current word
        setRevealedIndices(new Set());
        setHintsUsed(0);
        if (hintTimerRef.current) clearInterval(hintTimerRef.current);

        hintTimerRef.current = setInterval(() => {
            setRevealedIndices(prev => {
                const currentWord = words[currentIndex]?.word || "";
                if (prev.size >= currentWord.length) return prev;

                const next = new Set(prev);
                if (!next.has(0)) {
                    next.add(0);
                } else {
                    const unrevealed = Array.from({ length: currentWord.length }, (_, i) => i)
                        .filter(i => !next.has(i));
                    if (unrevealed.length > 0) {
                        next.add(unrevealed[Math.floor(Math.random() * unrevealed.length)]);
                    }
                }
                return next;
            });
        }, 7000);

        return () => {
            if (hintTimerRef.current) clearInterval(hintTimerRef.current);
        };
    }, [currentIndex, words, gameState]);

    // ── Current word helpers ──
    const currentWordData = words[currentIndex];
    const currentWord = currentWordData?.word || "";

    const getHintDisplay = () => {
        if (!currentWord) return "";
        return currentWord.split("").map((char: string, i: number) => {
            if (revealedIndices.has(i) || char === " ") return char;
            return "_";
        }).join(" ");
    };

    // ── Manual hint (reveal a letter, costs -1s) ──
    const handleHint = () => {
        if (gameState !== "playing" || !currentWord || hintsUsed >= MAX_HINTS) return;

        setHintsUsed(prev => prev + 1);
        setTimeLeft(prev => {
            const newTime = prev - 1;
            if (newTime <= 0) {
                if (timerRef.current) clearInterval(timerRef.current);
                if (socket && roomIdRef.current) {
                    socket.emit("player_finished", { roomId: roomIdRef.current });
                }
                return 0;
            }
            return newTime;
        });

        setRevealedIndices(prev => {
            if (prev.size >= currentWord.length) return prev;
            const next = new Set(prev);
            if (!next.has(0)) {
                next.add(0);
            } else {
                const unrevealed = Array.from({ length: currentWord.length }, (_, i) => i)
                    .filter(i => !next.has(i));
                if (unrevealed.length > 0) {
                    next.add(unrevealed[Math.floor(Math.random() * unrevealed.length)]);
                }
            }
            return next;
        });
    };

    // ── Pass / Skip word ──
    const handlePass = () => {
        if (gameState !== "playing" || !currentWord) return;
        setMessage(`Skipped! Word was "${currentWord}"`);
        setInput("");
        setRevealedIndices(new Set());
        setHintsUsed(0);
        setCurrentIndex(prev => prev + 1);
        setTimeout(() => setMessage(""), 2000);
    };

    // ── Submit guess ──
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (gameState !== "playing" || !input.trim()) return;

        // Online — send to server for validation
        if (socket && roomIdRef.current) {
            socket.emit("submit_guess", {
                roomId: roomIdRef.current,
                guess: input.trim()
            });
            // Don't clear input — server confirms via score_update
            return;
        }

        // Offline fallback
        if (currentWord && input.toLowerCase().trim() === currentWord.toLowerCase()) {
            setScore(s => s + 10);
            setCurrentIndex(prev => prev + 1);
            setInput("");
            setRevealedIndices(new Set());
            setHintsUsed(0);
        } else {
            setMessage("Try again!");
            setInput("");
            setTimeout(() => setMessage(""), 1000);
        }
    };

    // ── Give Up / Concede ──
    const handleGiveUp = () => {
        if (gameState !== "playing") return;
        const confirm = window.confirm("Are you sure you want to give up? You will instantly lose this match.");
        if (confirm) {
            if (socket && roomIdRef.current) {
                socket.emit("give_up", { roomId: roomIdRef.current });
            } else {
                // Offline handle
                setScore(-1);
                setGameState("finished");
            }
        }
    };

    // ── Result display ──
    const getResultDisplay = () => {
        if (!matchResult) {
            return { title: "Time's Up!", subtitle: `Score: ${score}`, rpText: "+0 RP", color: "var(--accent)" };
        }

        const myRp = matchResult.rpChanges[socket?.id] || 0;
        const rpText = myRp >= 0 ? `+${myRp} RP` : `${myRp} RP`;

        if (matchResult.isDraw) {
            return { title: "It's a Draw!", subtitle: `Both scored ${score}`, rpText, color: "var(--accent)" };
        } else if (matchResult.winner === socket?.id) {
            return { title: "🏆 Victory!", subtitle: `You won ${score} - ${opponentScore}`, rpText, color: "#4ade80" };
        } else {
            return { title: "Defeat", subtitle: `You lost ${score} - ${opponentScore}`, rpText, color: "var(--accent-deep)" };
        }
    };

    if (!matchData && !words.length) return <div>Loading Match...</div>;

    const isRanked = !!matchData?.opponent || (matchResult && matchResult.players.length > 1);

    return (
        <section className="main-panel match-layout">
            <header className="hero">
                <div className="brand">
                    <div className="logo">WO</div>
                    <div>
                        <p className="eyebrow">{isRanked ? "Ranked Duel" : "Sprint"}</p>
                        <h1>Rapid Fire</h1>
                    </div>
                </div>
                <div className="meta">
                    <div className="pill">
                        <span className="label">Time</span>
                        <span className="value" style={{ color: timeLeft <= 10 ? "var(--accent-deep)" : "inherit" }}>
                            {timeLeft}
                        </span>
                    </div>
                    <div className="pill">
                        <span className="label">You</span>
                        <span className="value">{score}</span>
                    </div>
                    {isRanked && (
                        <div className="pill">
                            <span className="label">{opponentName}</span>
                            <span className="value">{opponentScore}</span>
                        </div>
                    )}
                    {gameState === "playing" && (
                        <button
                            type="button"
                            onClick={handleGiveUp}
                            style={{
                                background: "transparent",
                                color: "var(--accent-deep)",
                                border: "1px solid var(--accent-deep)",
                                borderRadius: "30px",
                                padding: "4px 16px",
                                fontSize: "14px",
                                cursor: "pointer",
                                fontWeight: "bold",
                                marginLeft: "8px",
                            }}
                        >
                            Give Up
                        </button>
                    )}
                </div>
            </header>

            {/* Playing State */}
            {gameState === "playing" && words.length > 0 && (
                <>
                    <section className="card">
                        <div className="definition">
                            <p className="label">
                                Definition — Word {currentIndex + 1}
                            </p>
                            <p className="definition-text">
                                {words[currentIndex]?.definition || "Loading..."}
                            </p>
                            <p className="hint-text" style={{ marginTop: "12px", letterSpacing: "4px", fontFamily: "monospace", fontSize: "18px" }}>
                                {getHintDisplay()}
                            </p>
                        </div>
                    </section>

                    <section className="controls">
                        <div className="attempts">
                            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "12px" }}>
                                <button
                                    type="button"
                                    className="hint-button"
                                    onClick={handleHint}
                                    disabled={hintsUsed >= MAX_HINTS}
                                    style={{ opacity: hintsUsed >= MAX_HINTS ? 0.4 : 1 }}
                                >
                                    Hint ({MAX_HINTS - hintsUsed} left)
                                </button>
                                <button
                                    type="button"
                                    className="hint-button"
                                    style={{ borderColor: 'var(--accent-deep)', color: 'var(--accent-deep)' }}
                                    onClick={handlePass}
                                >
                                    Pass
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="guess-form" autoComplete="off">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Type your guess..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                autoFocus
                                spellCheck={false}
                                autoComplete="off"
                            />
                            <button type="submit">Submit</button>
                        </form>
                        {message && <p className="status-text">{message}</p>}
                    </section>

                    <section className="status">
                        <p className="status-text">
                            Words correct: {score / 10} | Score: {score}
                            {isRanked && ` | ${opponentName}: ${opponentScore}`}
                        </p>
                    </section>
                </>
            )}

            {/* Finished State */}
            {gameState === "finished" && (() => {
                const display = getResultDisplay();
                return (
                    <div className="card" style={{ textAlign: "center", padding: "40px" }}>
                        <h2 style={{ fontSize: "36px", color: display.color, marginBottom: "10px" }}>
                            {display.title}
                        </h2>
                        <p style={{ fontSize: "18px", opacity: 0.8, marginBottom: "8px" }}>
                            {display.subtitle}
                        </p>
                        <p style={{ fontSize: "14px", opacity: 0.6, marginBottom: "4px" }}>
                            Words Correct: {score / 10}
                        </p>
                        {player && (
                            <p style={{
                                fontSize: "20px",
                                fontWeight: "bold",
                                color: display.rpText.startsWith("-") ? "var(--accent-deep)" : "#4ade80",
                                margin: "16px 0"
                            }}>
                                {display.rpText}
                            </p>
                        )}
                        <button className="primary" onClick={onExit} style={{ marginTop: "20px" }}>
                            Return to Lobby
                        </button>
                    </div>
                );
            })()}
        </section>
    );
}
