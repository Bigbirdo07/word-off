"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
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
    const [words, setWords] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [input, setInput] = useState("");
    const [score, setScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [gameState, setGameState] = useState<"countdown" | "playing" | "finished">("countdown");
    const [countdown, setCountdown] = useState(5);
    const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
    const [opponentName, setOpponentName] = useState("Opponent");
    const [roomId, setRoomId] = useState<string | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const resultSavedRef = useRef(false);

    // Initialize words from matchData if already available
    useEffect(() => {
        if (matchData?.words) {
            setWords(matchData.words);
        }
        if (matchData?.opponent) {
            setOpponentName(matchData.opponent.username || "Opponent");
        }
        if (matchData?.roomId) {
            setRoomId(matchData.roomId);
        }
    }, [matchData]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) {
            // Offline/sprint fallback
            setGameState("countdown");
            startCountdown();
            return;
        }

        socket.on("match_start", (data: any) => {
            console.log("Match Start Data:", data);
            setWords(data.words);
            setRoomId(data.roomId);
            startCountdown();
        });

        socket.on("match_init", (data: any) => {
            console.log("Match Init:", data);
            if (data.opponent) {
                setOpponentName(data.opponent.username || "Opponent");
            }
            if (data.roomId) {
                setRoomId(data.roomId);
            }
        });

        socket.on("score_update", (data: any) => {
            if (data.socketId === socket.id) {
                setScore(data.score);
                setCurrentIndex(data.wordsCorrect || data.progress || 0);
                setInput("");
            } else {
                setOpponentScore(data.score);
            }
        });

        socket.on("match_result", (data: MatchResult) => {
            console.log("Match Result from server:", data);
            setMatchResult(data);
            setGameState("finished");
            if (timerRef.current) clearInterval(timerRef.current);
        });

        return () => {
            socket.off("match_start");
            socket.off("match_init");
            socket.off("score_update");
            socket.off("match_result");
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [socket]);

    function startCountdown() {
        setGameState("countdown");
        setCountdown(5);

        let count = 5;
        countdownRef.current = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(countdownRef.current!);
                setGameState("playing");
                startTimer();
                // Focus the input
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }, 1000);
    }

    function startTimer() {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(60);

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    // Signal server that our timer ended
                    if (socket && roomId) {
                        socket.emit("player_finished", { roomId });
                    }
                    // If no server (offline), end locally
                    if (!socket) {
                        setGameState("finished");
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    // Save result when game finishes with server results
    useEffect(() => {
        if (gameState === "finished" && player && !resultSavedRef.current) {
            resultSavedRef.current = true;
            saveResult();
        }
    }, [gameState, matchResult]);

    async function saveResult() {
        if (!player) return;

        // Use server results if available, otherwise calculate locally
        let result = "practice";
        let rpChange = 5;
        let finalScore = score;

        if (matchResult) {
            // Server-authoritative results
            const myResult = matchResult.players.find(p => p.socketId === socket?.id);
            if (myResult) finalScore = myResult.score;
            rpChange = matchResult.rpChanges[socket?.id] || 0;

            if (matchResult.isDraw) {
                result = "draw";
            } else if (matchResult.winner === socket?.id) {
                result = "win";
            } else if (matchResult.players.length > 1) {
                result = "loss";
            }
        } else if (!matchData?.opponent) {
            // Single player (Sprint) — no server result
            result = "practice";
            rpChange = 5;
        }

        const solvedWords = words.slice(0, currentIndex).map((w: any) => w.word);

        try {
            // 1. Save Match History
            const { error: historyError } = await supabase.from("match_history").insert([{
                player_id: player.id,
                opponent_name: opponentName || "Practice Bot",
                result: result,
                score: finalScore,
                rp_change: rpChange,
                words_solved: solvedWords
            }]);

            if (historyError) {
                console.error("Failed to save match history:", historyError.message, historyError.details);
            }

            // 2. Update Player Rank & Words Solved
            const newRp = Math.max(0, (player.rank_points || 0) + rpChange);
            const { error: updateError } = await supabase.from("players").update({
                rank_points: newRp,
                words_solved: (player.words_solved || 0) + currentIndex
            }).eq("id", player.id);

            if (updateError) {
                console.error("Failed to update player:", updateError.message, updateError.details);
            }

            console.log("Match Saved!", result, rpChange, "New RP:", newRp);

            // 3. Refresh player state in parent
            if (onUpdatePlayer) {
                onUpdatePlayer();
            }
        } catch (err) {
            console.error("Failed to save match:", err);
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (gameState !== "playing" || !input.trim()) return;

        // Online — send to server
        if (socket && roomId) {
            socket.emit("submit_guess", {
                roomId: roomId,
                guess: input.trim()
            });
            // Don't clear input here — server will confirm via score_update
            return;
        }

        // Offline fallback
        const currentWord = words[currentIndex]?.word;
        if (currentWord && input.toLowerCase().trim() === currentWord.toLowerCase()) {
            setScore(current => current + 10);
            setCurrentIndex(prev => prev + 1);
            setInput("");
        }
    };

    // Derive result display info
    const getResultDisplay = () => {
        if (!matchResult) {
            return { title: "Time's Up!", subtitle: `Score: ${score}`, rpText: "+5 RP", color: "var(--accent)" };
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
                            {gameState === "countdown" ? "—" : timeLeft}
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
                </div>
            </header>

            {/* Countdown Overlay */}
            {gameState === "countdown" && (
                <div className="card" style={{ textAlign: "center", padding: "40px" }}>
                    <p className="label">Get Ready!</p>
                    <h2 style={{ fontSize: "72px", margin: "20px 0", color: "var(--accent)" }}>
                        {countdown > 0 ? countdown : "GO!"}
                    </h2>
                    {isRanked && (
                        <p style={{ fontSize: "18px", opacity: 0.7 }}>
                            vs. <strong>{opponentName}</strong>
                        </p>
                    )}
                    <p style={{ fontSize: "14px", opacity: 0.5, marginTop: "10px" }}>
                        Read the definition. Type the word. Score points!
                    </p>
                </div>
            )}

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
                        </div>
                    </section>

                    <section className="controls">
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
                    </section>

                    <section className="status">
                        <p className="status-text">
                            Words correct: {currentIndex} | Score: {score}
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
                            Words Correct: {currentIndex}
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
