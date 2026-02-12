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

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const inputRef = useRef<HTMLInputElement | null>(null);
    const resultSavedRef = useRef(false);
    const gameStartedRef = useRef(false);

    // Refs to avoid stale closures in saveResult and startTimer
    const scoreRef = useRef(0);
    const currentIndexRef = useRef(0);
    const roomIdRef = useRef<string | null>(null);

    // Keep refs in sync with state
    useEffect(() => { scoreRef.current = score; }, [score]);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
    useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

    // Initialize words from matchData if already available
    // This handles the race condition where match_start fires before MatchView mounts
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
        // If matchData already has words, the match_start event already fired
        // before this component mounted — start game now
        if (matchData?.words?.length > 0 && !gameStartedRef.current) {
            gameStartedRef.current = true;
            startGame();
        }
    }, [matchData]);

    // Socket event listeners
    useEffect(() => {
        if (!socket) {
            // Offline/sprint fallback
            startGame();
            return;
        }

        socket.on("match_start", (data: any) => {
            console.log("Match Start Data:", data);
            setWords(data.words);
            setRoomId(data.roomId);
            if (!gameStartedRef.current) {
                gameStartedRef.current = true;
                startGame();
            }
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

        };
    }, [socket]);

    function startGame() {
        setGameState("playing");
        startTimer();
        // Focus the input
        setTimeout(() => inputRef.current?.focus(), 100);
    }

    function startTimer() {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(60);

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    // Signal server that our timer ended (use ref to avoid stale closure)
                    if (socket && roomIdRef.current) {
                        socket.emit("player_finished", { roomId: roomIdRef.current });
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
            saveResult(matchResult);
        }
    }, [gameState, matchResult]);

    async function saveResult(serverResult: MatchResult | null) {
        if (!player) return;

        // Read from refs to get the latest values (avoids stale closures)
        const latestScore = scoreRef.current;
        const latestIndex = currentIndexRef.current;

        // Use server results if available, otherwise calculate locally
        let result = "practice";
        let rpChange = 5;
        let finalScore = latestScore;

        if (serverResult) {
            // Server-authoritative results
            const myResult = serverResult.players.find(p => p.socketId === socket?.id);
            if (myResult) finalScore = myResult.score;
            rpChange = serverResult.rpChanges[socket?.id] || 0;

            if (serverResult.isDraw) {
                result = "draw";
            } else if (serverResult.winner === socket?.id) {
                result = "win";
            } else if (serverResult.players.length > 1) {
                result = "loss";
            }
        } else if (!matchData?.opponent) {
            // Single player (Sprint) — no server result
            result = "practice";
            rpChange = 5;
        }

        console.log("saveResult called — score:", latestScore, "index:", latestIndex, "rpChange:", rpChange, "result:", result);

        const solvedWords = words.slice(0, latestIndex).map((w: any) => w.word);

        try {
            // 1. Save Match History
            const cleanWords = Array.isArray(solvedWords)
                ? solvedWords.filter((w: any) => typeof w === "string" && w.length > 0)
                : [];

            const { error: historyError } = await supabase.from("match_history").insert([{
                player_id: player.id,
                opponent_name: opponentName || "Practice Bot",
                result: result,
                score: finalScore,
                rp_change: rpChange,
                words_solved: cleanWords
            }]);

            if (historyError) {
                console.error("Failed to save match history:", historyError.message, historyError.details, historyError.hint);
            }

            // 2. Update Player Rank, Tier & Words Solved
            const newRp = Math.max(0, (player.rank_points || 0) + rpChange);
            const rankInfo = getRankFromRP(newRp);

            const { error: updateError } = await supabase.from("players").update({
                rank_points: newRp,
                rank_tier: rankInfo.tier,
                words_solved: (player.words_solved || 0) + latestIndex
            }).eq("id", player.id);

            if (updateError) {
                console.error("Failed to update player:", updateError.message, updateError.details, updateError.hint);
            }

            console.log("Match Saved!", result, rpChange, "New RP:", newRp, "Tier:", rankInfo.tier);

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
