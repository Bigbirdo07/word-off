"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Player } from "../hooks/useAuth";

interface MatchViewProps {
    socket: any;
    matchData: any;
    onExit: () => void;
    player: Player | null;
}

export function MatchView({ socket, matchData, onExit, player }: MatchViewProps) {
    const [words, setWords] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [input, setInput] = useState("");
    const [score, setScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);
    const [gameState, setGameState] = useState<"waiting" | "playing" | "finished">("waiting");

    // Refs for timer interval
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // If no socket, we are in offline mode (Sprint)
        if (!socket) {
            setGameState("playing");
            setWords(matchData?.words || []);
            startTimer();
            return;
        }

        // Listen for match start (full data)
        socket.on("match_start", (data: any) => {
            console.log("Match Start Data:", data);
            setWords(data.words);
            setGameState("playing");
            startTimer();
        });

        socket.on("score_update", (data: any) => {
            if (data.socketId === socket.id) {
                setScore(data.score);
                setCurrentIndex(data.progress || currentIndex + 1);
                setInput(""); // Clear input on success
            } else {
                setOpponentScore(data.score);
            }
        });

        return () => {
            socket.off("match_start");
            socket.off("score_update");
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [socket, matchData]); // Added matchData dependecy for offline init

    function startTimer() {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    setGameState("finished");
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }

    // Save history when game finishes
    useEffect(() => {
        if (gameState === "finished" && player) {
            saveResult();
        }
    }, [gameState]);

    async function saveResult() {
        if (!player) return;

        // Calculate Result
        let result = "draw";
        let rpChange = 5;
        if (score > opponentScore) {
            result = "win";
            rpChange = 25;
        } else if (score < opponentScore) {
            result = "loss";
            rpChange = -10;
        }

        // Single player (Sprint) override
        if (!matchData?.opponent) {
            result = "practice";
            rpChange = 5; // Small reward for practice
        }

        const solvedWords = words.slice(0, currentIndex).map(w => w.word);

        // 1. Save Match History
        await supabase.from("match_history").insert([{
            player_id: player.id,
            opponent_name: matchData?.opponent?.username || "Practice Bot",
            result: result,
            score: score,
            rp_change: rpChange,
            words_solved: solvedWords
        }]);

        // 2. Update Player Rank & Words Solved
        await supabase.from("players").update({
            rank_points: (player.rank_points || 0) + rpChange,
            words_solved: (player.words_solved || 0) + currentIndex
        }).eq("id", player.id);

        console.log("Match Saved!", result, rpChange);
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (gameState !== "playing") return;

        // Offline logic
        if (!socket) {
            const currentWord = words[currentIndex]?.word;
            if (input.toLowerCase().trim() === currentWord.toLowerCase()) {
                setScore(current => current + 10); // Local scoring
                setCurrentIndex(prev => prev + 1);
                setInput("");
            }
            return;
        }

        socket.emit("submit_guess", {
            roomId: matchData?.roomId || "test-room",
            guess: input
        });
    };

    if (!matchData) return <div>Loading Match...</div>;

    return (
        <section className="main-panel match-layout">
            <header className="hero">
                <div className="brand">
                    <div className="logo">WO</div>
                    <div>
                        <p className="eyebrow">Ranked Duel</p>
                        <h1>Rapid Fire</h1>
                    </div>
                </div>
                <div className="meta">
                    <div className="pill">
                        <span className="label">Time</span>
                        <span className="value">{timeLeft}</span>
                    </div>
                    <div className="pill">
                        <span className="label">You</span>
                        <span className="value">{score}</span>
                    </div>
                    <div className="pill">
                        <span className="label">Opponent</span>
                        <span className="value">{opponentScore}</span>
                    </div>
                </div>
            </header>

            {gameState === "waiting" && (
                <div className="card">
                    <h2>Waiting for server to start...</h2>
                </div>
            )}

            {gameState === "playing" && words.length > 0 && (
                <>
                    <section className="card">
                        <div className="definition">
                            <p className="label">Definition</p>
                            <p className="definition-text">
                                {words[currentIndex]?.definition || "Loading..."}
                            </p>
                        </div>
                    </section>

                    <section className="controls">
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
                    </section>
                </>
            )}

            {gameState === "finished" && (
                <div className="card">
                    <h2>Time's Up!</h2>
                    <p>Final Score: {score}</p>
                    <p>Opponent: {opponentScore}</p>
                    <button className="primary" onClick={onExit}>Return to Lobby</button>
                </div>
            )}

        </section>
    );
}
